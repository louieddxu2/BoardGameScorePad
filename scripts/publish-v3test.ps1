[CmdletBinding()]
param(
    [string]$Branch = "V3test",
    [string]$Remote = "origin",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serviceWorkerPath = Join-Path $repoRoot "public\sw.js"
$cachePattern = 'boardgame-scorepad-cache-(?<date>\d{4}-\d{2}-\d{2})-(?<revision>\d{2})'

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $false)][string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
    }
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
    return @($output)
}

Push-Location $repoRoot
try {
    if (-not (Test-Path -LiteralPath $serviceWorkerPath)) {
        throw "Service worker not found: $serviceWorkerPath"
    }

    $currentBranch = ((Get-GitOutput @("branch", "--show-current")) -join "").Trim()
    if ($currentBranch -ne $Branch) {
        throw "Publishing is restricted to branch '$Branch'. Current branch: '$currentBranch'."
    }

    $statusBefore = @(Get-GitOutput @("status", "--porcelain", "--untracked-files=all"))
    if ($statusBefore.Count -gt 0) {
        throw "Working tree must be clean before publishing:`n$($statusBefore -join "`n")"
    }

    $serviceWorkerContent = [System.IO.File]::ReadAllText($serviceWorkerPath)
    $cacheMatches = [regex]::Matches($serviceWorkerContent, $cachePattern)
    if ($cacheMatches.Count -ne 1) {
        throw "Expected exactly one dated CACHE_NAME in public/sw.js; found $($cacheMatches.Count)."
    }

    $currentCache = $cacheMatches[0]
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $currentDate = $currentCache.Groups["date"].Value
    $currentRevision = [int]$currentCache.Groups["revision"].Value
    if ($currentDate -gt $today) {
        throw "Service-worker cache date '$currentDate' is ahead of today '$today'."
    }
    $nextRevision = if ($currentDate -eq $today) { $currentRevision + 1 } else { 1 }

    if ($nextRevision -gt 99) {
        throw "Same-day service-worker revision exceeded 99."
    }

    $nextCacheName = "boardgame-scorepad-cache-$today-$('{0:D2}' -f $nextRevision)"
    Write-Host "Next service-worker cache: $nextCacheName" -ForegroundColor Cyan

    if ($DryRun) {
        Write-Host "Dry run: no files changed, no commit created, and nothing pushed." -ForegroundColor Yellow
        return
    }

    Write-Host "Running TypeScript type-check..." -ForegroundColor White
    Invoke-CheckedCommand "npx.cmd" @("tsc", "--noEmit")

    Write-Host "Running core tests..." -ForegroundColor White
    Invoke-CheckedCommand "npx.cmd" @(
        "vitest",
        "run",
        "--exclude",
        "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"
    )

    $updatedContent = $serviceWorkerContent.Replace($currentCache.Value, $nextCacheName)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($serviceWorkerPath, $updatedContent, $utf8NoBom)

    Write-Host "Checking updated service worker..." -ForegroundColor White
    Invoke-CheckedCommand "node" @("--check", $serviceWorkerPath)

    $statusAfter = @(Get-GitOutput @("status", "--porcelain", "--untracked-files=all"))
    if ($statusAfter.Count -ne 1 -or $statusAfter[0] -notmatch '^\s*M\s+public/sw\.js$') {
        throw "Release changed files other than public/sw.js:`n$($statusAfter -join "`n")"
    }

    Write-Host "Committing service-worker revision..." -ForegroundColor White
    Invoke-CheckedCommand "git" @("add", "--", "public/sw.js")
    $stagedFiles = @(Get-GitOutput @("diff", "--cached", "--name-only"))
    if ($stagedFiles.Count -ne 1 -or $stagedFiles[0] -ne "public/sw.js") {
        throw "Only public/sw.js may be included in the release commit."
    }
    Invoke-CheckedCommand "git" @("commit", "-m", "chore(pwa): bump service worker cache revision")

    Write-Host "Pushing $Remote/$Branch..." -ForegroundColor White
    Invoke-CheckedCommand "git" @("push", $Remote, $Branch)
    Write-Host "=== Published $Branch with service-worker revision $nextCacheName ===" -ForegroundColor Green
}
finally {
    Pop-Location
}

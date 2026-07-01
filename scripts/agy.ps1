# Antigravity task wrapper.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 "Analyze this repo"
#   scripts\agy.cmd Analyze this repo

[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$Instruction,

    [string]$WrapperPath = $env:AGY_WRAPPER,

    [string]$WorkspaceDir,

    [string]$Python = "python",

    [switch]$ListWrappers,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-AgyWrapperCandidates {
    $brainRoot = Join-Path $HOME ".gemini\antigravity\brain"
    if (-not (Test-Path -LiteralPath $brainRoot)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $brainRoot -Recurse -Filter "agy_wrapper.py" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending)
}

function Resolve-AgyWrapper {
    param([string]$PathFromUser)

    if ($PathFromUser) {
        $expanded = [Environment]::ExpandEnvironmentVariables($PathFromUser)
        if (-not (Test-Path -LiteralPath $expanded)) {
            throw "AGY wrapper not found: $expanded"
        }
        return (Resolve-Path -LiteralPath $expanded).Path
    }

    $candidates = Get-AgyWrapperCandidates
    if ($candidates.Count -eq 0) {
        throw "No agy_wrapper.py found under $HOME\.gemini\antigravity\brain. Set AGY_WRAPPER to the wrapper path."
    }

    return $candidates[0].FullName
}

if ($ListWrappers) {
    $candidates = Get-AgyWrapperCandidates
    if ($candidates.Count -eq 0) {
        Write-Host "No agy_wrapper.py files found."
        exit 1
    }

    $candidates | Select-Object LastWriteTime, FullName | Format-Table -AutoSize
    exit 0
}

if (-not $Instruction -or $Instruction.Count -eq 0) {
    Write-Host "Usage: scripts\agy.cmd <instruction>"
    Write-Host "       powershell -ExecutionPolicy Bypass -File scripts\agy.ps1 <instruction>"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -ListWrappers       Show detected Antigravity wrapper files."
    Write-Host "  -WrapperPath <path> Use a specific agy_wrapper.py."
    Write-Host "  -DryRun             Print the command without running it."
    exit 2
}

if (-not $WorkspaceDir) {
    $WorkspaceDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}
else {
    $WorkspaceDir = (Resolve-Path -LiteralPath $WorkspaceDir).Path
}

$resolvedWrapper = Resolve-AgyWrapper -PathFromUser $WrapperPath
$instructionText = ($Instruction -join " ").Trim()

if (-not $instructionText) {
    throw "Instruction cannot be empty."
}

if ($DryRun) {
    Write-Host "Python:  $Python"
    Write-Host "Wrapper: $resolvedWrapper"
    Write-Host "Workspace: $WorkspaceDir"
    Write-Host "Prompt:  $instructionText"
    exit 0
}

Push-Location -LiteralPath $WorkspaceDir
try {
    & $Python $resolvedWrapper $instructionText
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

# Unified Verification Script
# Runs all quality checks in sequence. Stops and reports on first failure.
# Usage: powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"

$ErrorActionPreference = "Stop"
$allPassed = $true

Write-Host ""
Write-Host "=== Board Game ScorePad - Verification ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Cloud API Bypass check
Write-Host "[1/4] Scanning for direct cloud API references (must use cloudClient.ts)..." -ForegroundColor White
$bypassFound = $false
try {
    $srcPath = Join-Path $PSScriptRoot "..\src"
    $files = Get-ChildItem -Path $srcPath -Recurse -Include *.ts, *.tsx
    foreach ($file in $files) {
        $path = $file.FullName
        if ($path.EndsWith("cloudClient.ts") -or $path.Contains(".test.") -or $path.Contains(".spec.")) {
            continue
        }
        $lines = Get-Content -Path $path -ErrorAction SilentlyContinue
        if ($lines) {
            $lineNum = 1
            foreach ($line in $lines) {
                if ($line.Contains("VITE_TEMPLATE_SHARE_API_BASE_URL") -or $line.Contains("scoreboard-api.louieddxu2")) {
                    Write-Host "  ⚠️ Bypass found in: $path (Line $lineNum)" -ForegroundColor Yellow
                    Write-Host "    Code: $($line.Trim())" -ForegroundColor Gray
                    $bypassFound = $true
                }
                $lineNum++
            }
        }
    }
    if ($bypassFound) {
        Write-Host "[1/4] FAIL: All cloud API network requests must be encapsulated in cloudClient.ts!" -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host "[1/4] OK" -ForegroundColor Green
    }
}
catch {
    Write-Host "[1/4] FAIL: $_" -ForegroundColor Red
    $allPassed = $false
}

# Step 2: Hardcoded Chinese scan
Write-Host ""
Write-Host "[2/4] Scanning for hardcoded Chinese strings..." -ForegroundColor White
try {
    powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\scan-hardcoded-chinese.ps1"
    if ($LASTEXITCODE -ne 0) { $allPassed = $false; Write-Host "[2/4] FAIL" -ForegroundColor Red }
    else { Write-Host "[2/4] OK" -ForegroundColor Green }
}
catch {
    Write-Host "[2/4] FAIL: $_" -ForegroundColor Red
    $allPassed = $false
}

# Step 3: TypeScript type check
Write-Host ""
Write-Host "[3/4] TypeScript type check (tsc)..." -ForegroundColor White
$tscOutput = cmd /c "npx tsc --noEmit --pretty false 2>&1" | Out-String
$tscExitCode = $LASTEXITCODE

if ($tscExitCode -ne 0) {
    Write-Host "TypeScript errors found:" -ForegroundColor Yellow
    Write-Host $tscOutput -ForegroundColor Gray
    Write-Host "[3/4] FAIL" -ForegroundColor Red
    $allPassed = $false
}
else {
    Write-Host "[3/4] OK" -ForegroundColor Green
}

# Step 4: Full Test Suite (vitest: Unit + UI + Tokens)
Write-Host ""
Write-Host "[4/4] Running full test suite (vitest)..." -ForegroundColor White
$testOutput = cmd /c "npx vitest run --no-color 2>&1" | Out-String
$testExitCode = $LASTEXITCODE

if ($testExitCode -ne 0) {
    Write-Host "Tests failed:" -ForegroundColor Yellow
    Write-Host $testOutput -ForegroundColor Gray
    Write-Host "[4/4] FAIL" -ForegroundColor Red
    $allPassed = $false
}
else {
    # If success, show passing counts
    $summary = $testOutput | Select-String "Tests.*passed" | Select-Object -Last 1
    if ($summary) { Write-Host $summary.Line.Trim() -ForegroundColor Gray }
    Write-Host "[4/4] OK" -ForegroundColor Green
}

# Final result
Write-Host ""
if ($allPassed) {
    Write-Host "=== ALL OK - Safe to commit ===" -ForegroundColor Green
}
else {
    Write-Host "=== FAILED - Fix issues before committing ===" -ForegroundColor Red
    exit 1
}
Write-Host ""

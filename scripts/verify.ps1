# Unified Verification Script
# Runs all quality checks in sequence. Stops and reports on first failure.
# Usage: powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"

$ErrorActionPreference = "Stop"
$allPassed = $true

Write-Host ""
Write-Host "=== Board Game ScorePad - Verification ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Hardcoded Chinese scan
Write-Host "[1/3] Scanning for hardcoded Chinese strings..." -ForegroundColor White
try {
    powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\scan-hardcoded-chinese.ps1"
    if ($LASTEXITCODE -ne 0) { $allPassed = $false; Write-Host "[1/3] FAIL" -ForegroundColor Red }
    else { Write-Host "[1/3] OK" -ForegroundColor Green }
}
catch {
    Write-Host "[1/3] FAIL: $_" -ForegroundColor Red
    $allPassed = $false
}

# Step 2: TypeScript type check
Write-Host ""
Write-Host "[2/3] TypeScript type check..." -ForegroundColor White
$tscOutput = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $tscOutput
    Write-Host "[2/3] FAIL" -ForegroundColor Red
    $allPassed = $false
}
else {
    Write-Host "[2/3] OK" -ForegroundColor Green
}

# Step 3: Unit tests
Write-Host ""
Write-Host "[3/3] Running unit tests (vitest)..." -ForegroundColor White
npm test 2>&1 | Tee-Object -Variable testOutput | Out-Null
$testSummary = $testOutput | Select-String "Tests|passed|failed" | Select-Object -Last 3
$testSummary | ForEach-Object { Write-Host $_.Line }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[3/3] FAIL" -ForegroundColor Red
    $allPassed = $false
}
else {
    Write-Host "[3/3] OK" -ForegroundColor Green
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

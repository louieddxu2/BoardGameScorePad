# Compatibility entry point. The Node checker owns all color rules and exceptions.
$ErrorActionPreference = "Stop"
Push-Location (Join-Path $PSScriptRoot "..")
try {
    & node scripts/check-theme.mjs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

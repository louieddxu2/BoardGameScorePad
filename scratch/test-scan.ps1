$excludeFileSubstrings = @(
    "\src\i18n\",
    "\node_modules\",
    "\dist\",
    "\data\",
    "\ErrorBoundary.tsx",
    ".test.ts",
    ".test.tsx",
    "\mocks\",
    "\tests\",
    "\services\cloud\googleDriveClient.ts",
    "\services\relationship\",
    "\features\bgstats\services\historyBatchUtils.ts",
    "\features\recommendation\SessionPlayerInitializer.ts",
    "\utils\dataMigration.ts",
    "\features\ai-generator\aiSystemPrompt.ts"
)

$excludeLinePatterns = @(
    '^\s*//',           # Single-line comment
    '^\s*\*',           # JSDoc / block comment line
    '^\s*/\*',          # Block comment open
    '^\s*\*/',          # Block comment close
    'console\.',        # console.log/warn/error
    'alert\(',          # alert() dialogs
    '^\s*description:', # Description strings in config objects
    '^\s*//.*',         # Comment after code
    '//.*[\u4e00-\u9fa5]', # Inline comment at end of line
    '\{\s*/\*',         # JSX multi-line comment open
    '\*/\s*\}',         # JSX multi-line comment close
    'findIdx\(',        # CSV import mappings
    'describe\(',       # Test describe (fallback if file exclusion missed it)
    'it\('              # Test it (fallback)
)

$allFiles = Get-ChildItem -Path "src" -Recurse -Include "*.tsx", "*.ts" -ErrorAction SilentlyContinue

$results = foreach ($file in $allFiles) {
    $shouldSkip = $excludeFileSubstrings | Where-Object { $file.FullName.Contains($_) }
    if ($shouldSkip) { continue }

    # Test with UTF8 encoding
    $lines = Get-Content -Encoding UTF8 $file.FullName -ErrorAction SilentlyContinue
    if (-not $lines) { continue }

    $lineNum = 0
    foreach ($line in $lines) {
        $lineNum++

        if ($line -notmatch "[\u4e00-\u9fa5]") { continue }

        $isExcluded = $excludeLinePatterns | Where-Object { $line -match $_ }
        if ($isExcluded) { continue }

        [PSCustomObject]@{
            File    = $file.FullName.Replace((Get-Location).Path + "\", "")
            Line    = $lineNum
            Content = $line.Trim()
        }
    }
}

if ($results) {
    Write-Host "Found with UTF8:"
    $results | Format-Table File, Line, Content -AutoSize -Wrap
} else {
    Write-Host "No hardcoded Chinese strings found with UTF8!"
}

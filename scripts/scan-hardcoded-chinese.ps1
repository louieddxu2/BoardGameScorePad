# Hardcoded Chinese Character Scanner
# Purpose: Find hardcoded Chinese UI strings in .tsx/.ts files that should be in i18n dictionaries.
#          Excludes: i18n dictionary files, comments, console.log, alert(), and type files.
# Usage:   Run from project root: .\scripts\scan-hardcoded-chinese.ps1

# File-level exclusions: skip entire files/directories matching these partial paths
$excludeFileSubstrings = @(
    "\src\i18n\",
    "\node_modules\",
    "\dist\",
    "\constants.ts",
    "\ErrorBoundary.tsx",  # 安全網元件：刻意使用硬編碼雙語字串，不依賴 LanguageProvider
    ".test.ts",
    ".test.tsx",
    "\mocks\",
    "\tests\",
    "\services\cloud\googleDriveClient.ts", # 內部開發用錯誤訊息，非對外 UI
    "\services\relationship\", # 底層 Regex 檢查名稱規則
    "\features\bgstats\services\historyBatchUtils.ts", # 歷史批次預設玩家名稱（寫入用，不在此翻譯）
    "\features\recommendation\SessionPlayerInitializer.ts", # 判斷預設名稱的正則表達式
    "\utils\dataMigration.ts" # 歷史資料庫轉移用標籤
)

# Line-level exclusions: skip lines matching these patterns (comments, dev-only calls, etc.)
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
    # Skip excluded files/directories
    $shouldSkip = $excludeFileSubstrings | Where-Object { $file.FullName.Contains($_) }
    if ($shouldSkip) { continue }

    $lines = Get-Content $file.FullName -ErrorAction SilentlyContinue
    if (-not $lines) { continue }

    $lineNum = 0
    foreach ($line in $lines) {
        $lineNum++

        # Skip if no Chinese characters
        if ($line -notmatch "[\u4e00-\u9fa5]") { continue }

        # Skip excluded line patterns
        $isExcluded = $excludeLinePatterns | Where-Object { $line -match $_ }
        if ($isExcluded) { continue }

        [PSCustomObject]@{
            File    = $file.FullName.Replace((Get-Location).Path + "\", "")
            Line    = $lineNum
            Content = $line.Trim().Substring(0, [Math]::Min(90, $line.Trim().Length))
        }
    }
}

if ($results) {
    Write-Host ""
    Write-Host "[WARNING] Found $($results.Count) possible hardcoded Chinese UI string(s):" -ForegroundColor Yellow
    Write-Host ""
    $results | Format-Table File, Line, Content -AutoSize -Wrap
    Write-Host "Move UI strings into the corresponding src/i18n/*.ts dictionary and use the translation hook." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
else {
    Write-Host ""
    Write-Host "[OK] Scan complete. No hardcoded Chinese UI strings found." -ForegroundColor Green
    Write-Host ""
    exit 0
}

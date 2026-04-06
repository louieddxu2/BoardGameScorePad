# Hardcoded HEX/RGB Color Scanner
# Purpose: Find hardcoded color values (Hex, RGB, RGBA) in .tsx/.ts files that should use Tailwind semantic classes or CSS variables.
#          Excludes: Theme definitions (index.css), core color palette (src/colors.ts), texture mapping logic, and test files.
# Usage:   Run from project root: .\scripts\scan-hardcoded-colors.ps1

# File-level exclusions: skip entire files/directories matching these partial paths
$excludeFileSubstrings = @(
    "\src\colors.ts",             # 玩家/資源顏色源頭：允許 Hex 碼
    "\src\index.css",              # 主題定義檔：允許 Hex 碼映射為變數
    "\src\utils\ui.ts",            # UI 工具函式：包含亮度計算與光暈常數
    "\src\data\",                  # 靜態資料：可能包含預設顏色定義
    "\src\features\bgstats\services\historyBatchUtils.ts", # 外部導入時的備選顏色
    "\node_modules\",
    "\dist\",
    ".test.ts",
    ".test.tsx"
)

# Line-level exclusions: skip lines matching these patterns
$excludeLinePatterns = @(
    '^\s*//',                      # Single-line comment
    '^\s*\*',                      # JSDoc / block comment line
    '^\s*/\*',                     # Block comment open
    '^\s*\*/',                     # Block comment close
    'console\.',                   # console.log/warn/error
    'url\(',                       # CSS URLs
    'data:image',                  # Base64 images
    '"transparent"',               # Keyword transparent
    "'transparent'",
    'background-size:',            # Background grid patterns
    'radial-gradient\(',           # Complex gradients (allow for now)
    '\[background-size:',          # Tailwind arbitrary property
    '^\s*//.*'                     # Comment after code
)

# Regex Patterns for Colors
# 1. HEX Colors: # followed by 3, 6, or 8 hex digits
$hexPattern = "#(?:[A-Fa-f0-9]{3}){1,12}\b" # [Refined] Support standard and short hex
# 2. RGB/RGBA Colors
$rgbPattern = "rgba?\([\s\d,\.\%]+\)" # [Refined] Support percent and extra spaces
# 3. Hardcoded Theme-Specific Tints: -50, -100
# These shades are fundamentally "Light" and bypass our dynamic variable mapping logic, often breaking Dark Mode.
$shadePattern = "\b(?:bg|text|border|ring|shadow|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100)\b"

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

        # Match Hex, RGB or Suspicious Tints
        $hasColor = ($line -match $hexPattern) -or ($line -match $rgbPattern) -or ($line -match $shadePattern)
        if (-not $hasColor) { continue }

        # Skip excluded line patterns
        $isExcluded = $excludeLinePatterns | Where-Object { $line -match $_ }
        if ($isExcluded) { continue }

        [PSCustomObject]@{
            File    = $file.FullName.Replace((Get-Location).Path + "\", "")
            Line    = $lineNum
            Content = $line.Trim().Substring(0, [Math]::Min(120, $line.Trim().Length))
        }
    }
}

if ($results) {
    Write-Host ""
    Write-Host "[WARNING] Found $($results.Count) hardcoded color value(s):" -ForegroundColor Red
    Write-Host "Please use Tailwind semantic classes (e.g., text-slate-50) or CSS variables (var(--custom-color)) for theme compatibility." -ForegroundColor Yellow
    Write-Host ""
    $results | Format-Table File, Line, Content -AutoSize -Wrap
    Write-Host ""
    exit 1
}
else {
    Write-Host ""
    Write-Host "[OK] Scan complete. No hardcoded HEX/RGB colors found in components." -ForegroundColor Green
    Write-Host ""
    exit 0
}

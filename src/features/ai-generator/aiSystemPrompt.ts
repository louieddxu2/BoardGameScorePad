/**
 * Board Game ScorePad — AI Scoring Generator 超頻極簡版提示詞 V4.2
 * 完美落地「節點平移線性累加」極限閉環數學模型，實現多重情境的終極多樣性對齊。
 */

// ============================================================================
// 🧠 繁體中文版 (SYSTEM_PROMPT_ZH)
// ============================================================================
export const SYSTEM_PROMPT_ZH = `# 桌遊計分板轉換器 (Lite)

請依照我提供的桌上遊戲名稱與計分規則圖片，提取出所有計分項目，依照後述的 JSON 格式生成繁體中文的計分板 JSON。

## 輸出格式
只輸出純 JSON，不要任何 Markdown 包裝或額外解釋。頂層結構：
\`\`\`json
{
  "name": "遊戲名稱",
  "columns": [ ... ]
}
\`\`\`

## 欄位屬性定義
| 屬性 | 必填 | 說明 |
|---|---|---|
| \`name\` | ✅ | 項目名稱。精簡為 6 字以內，超過 4 字適當用 \`\\n\` 換行。*例：「最長道路」* |
| \`explain\` | | 計分邏輯極簡概述 (嚴格限 8 字內)，作為推導公式的思考輔助 |
| \`formula\` | ✅ | 計分公式。見下方公式表 |
| \`unit\` | | 根據此項目要求使用者輸入數值的量詞。(如：動物為「隻」、卡片數量為「張」，大多物體通用的「個」) |
| \`subUnits\` | | 若用兩數相乘公式，填寫兩個相乘項目的量詞，如 \`["星", "個"]\` |
| \`color\` | | 若規則圖片能明顯判斷此項目的顏色，用以下一個字來表示：「紅」、「藍」、「黃」、「綠」、「橘」、「紫」、「黑」、「灰」、「褐」 |
| \`quickActions\` | | 若為固定按鈕，寫按鈕標籤與對應數值。見下方公式說明 |
| \`functions\` | | 查表函數定義。見下方公式說明 |

---

## 公式表 (極簡 7 式)
根據項目計分方式選擇公式，優先選擇前 3 種基本公式。乘號務必使用全形 \`×\`。

### 🟢 基礎公式
1. **\`a1\`** (直接數值)：分數是單一來源，無須額外計算或累加。難以判斷的情況請優先選擇此公式。*例：「圖板最終分數」*。
2. **\`a1×倍率\`** (倍率計分)：寫作 \`a1×3\` 或 \`a1×(-5)\`。*例：每個工人 3 分寫作 \`a1×3\`*。
3. **\`a1+next\`** (分項累加)：需要逐一輸入同類子項的分數得到總和時。*例：「所有達成任務的分數」、「每張卡片的分數」*。

### 🟠 進階公式
4. **\`a1×a2\`** (兩數相乘)：兩個數值都需玩家手動輸入。*需搭配 \`subUnits\`*。
5. **\`(a1×a2)+next\`** (相乘後累加)：多組 [數量 × 乘數] 需要分次累加。
6. **\`f1(a1)\`** (查表計分)：階梯分數。在 \`functions.f1\` 寫 \`[數量]>[分數]\`。
   *例 1：1~2個1分，3~5個3分，6個以上固定8分，記為：*
   \`\`\`json
   "functions": {"f1": "[0,1,3,6]>[0,1,3,8]"}
   \`\`\`
   *例 2：0個-1分，1~2個1分，3~5個3分，6個得6分，超過6個每個多2分，記為：*
   \`\`\`json
   "functions": {"f1": "[0,1,3,6,+]>[-1,1,3,6,2]"}
   \`\`\`
7. **\`a1\`** + 按鈕 (按鈕選單)：在 \`quickActions\` 寫 \`['標籤']>[分數]\`。
   *例：是=10分, 否=0分 記為：*
   \`\`\`json
   "quickActions": "['是','否']>[10,0]"
   \`\`\`

---

## 完整極簡對齊範例 (展示 7 種公式與簡寫)

\`\`\`json
{
  "name": "範例桌遊",
  "columns": [
    {
      "name": "終點分數",
      "formula": "a1",
      "unit": "分"
    },
    {
      "name": "家庭成員",
      "formula": "a1×3",
      "unit": "人"
    },
    {
      "name": "發展卡",
      "explain": "分項輸入分數並加總",
      "formula": "a1+next"
    },
    {
      "name": "住宅",
      "explain": "星級乘以住宅數量",
      "formula": "a1×a2",
      "subUnits": ["星", "個"],
      "color": "藍"
    },
    {
      "name": "麥田地形",
      "explain": "格數乘皇冠並累加",
      "formula": "(a1×a2)+next",
      "subUnits": ["格", "冠"],
      "color": "綠"
    },
    {
      "name": "麥子存量",
      "explain": "階梯扣分與倍增",
      "formula": "f1(a1)",
      "unit": "份",
      "functions": {
        "f1": "[0,1,3,+]>[-1,1,2,2]"
      }
    },
    {
      "name": "是否符合\\n中央城堡",
      "explain": "檢查建設條件是否達成",
      "formula": "a1",
      "quickActions": "['是','否']>[10,0]"
    }
  ]
}
\`\`\`
`;

// ============================================================================
// 🧠 英文版 (SYSTEM_PROMPT_EN)
// ============================================================================
export const SYSTEM_PROMPT_EN = `# Board Game Scoreboard Converter (Lite)

Please extract all scoring items from the game name and rules image provided by me, and generate JSON according to the format below.

## Output Format
Output ONLY pure JSON, NO explanations. Top-level structure:
\`\`\`json
{
  "name": "Game Name",
  "columns": [ ... ]
}
\`\`\`

## Column Properties
| Property | Req | Description |
|---|---|---|
| \`name\` | ✅ | Item name. Shorten to 1-3 words. Use \`\\n\` for wrapping. *Ex: "Longest Road"* |
| \`explain\` | | Ultra-short scoring logic (strictly < 10 words) as a thinking aid |
| \`formula\` | ✅ | Scoring formula. See formula table below |
| \`unit\` | | Measurement unit for input numbers. (Ex: animal is "pcs", card counts is "cards") |
| \`subUnits\` | | Labels for multiplied formula inputs, e.g. \`["Stars", "Tiles"]\` |
| \`color\` | | If clear visually, represent with ONE keyword: "Red", "Blue", "Yellow", "Green", "Orange", "Purple", "Black", "Gray", "Brown" |
| \`quickActions\` | | For buttons, write label array and score array. See formula table |
| \`functions\` | | Chart lookup mapping definitions. See below |

---

## Formula Table (7 Modes)
Choose formula based on scoring method, prioritize the first 3. Use full-width \`×\`.

### 🟢 Basic Formulas
1. **\`a1\`** (Direct Value): Single point source requiring no calculations. Prioritize this formula if unclear. *Ex: "Final Scoretrack"*
2. **\`a1×multiplier\`** (Multiplier): Write as \`a1×3\` or \`a1×(-5)\`. *Ex: Each worker gets 3 pts -> \`a1×3\`*
3. **\`a1+next\`** (Accumulator): Multiple sub-items logged step-by-step. *Ex: "All Objective Card Scores", "Score for Each Individual Card"*

### 🟠 Advanced Formulas
4. **\`a1×a2\`** (Multiplication): Both inputs manually entered. *Requires \`subUnits\`*
5. **\`(a1×a2)+next\`** (Accumulated Multiplications): Multiple [Tiles × Crowns] logged step-by-step.
6. **\`f1(a1)\`** (Chart Lookup): Step function mapping. Write \`[count]>[points]\` in \`functions.f1\`.
   *Ex 1: 1-2 qty=1pt, 3-5 qty=3pt, 6 or more qty=8pt, is written as:*
   \`\`\`json
   "functions": {"f1": "[0,1,3,6]>[0,1,3,8]"}
   \`\`\`
   *Ex 2: 0 qty=-1pt, 1-2 qty=1pt, 3-5 qty=3pt, 6 qty=6pt, over 6 qty are +2pt each, is written as:*
   \`\`\`json
   "functions": {"f1": "[0,1,3,6,+]>[-1,1,3,6,2]"}
   \`\`\`
7. **\`a1\`** + Buttons (Clicker): Write \`['Label']>[points]\` in \`quickActions\`.
   *Ex: Yes=10pt, No=0pt is written as:*
   \`\`\`json
   "quickActions": "['Yes','No']>[10,0]"
   \`\`\`

---

## Full Ground Truth Example (Showing ultra-dense syntax)

\`\`\`json
{
  "name": "Sample Game",
  "columns": [
    {
      "name": "Direct Score",
      "formula": "a1",
      "unit": "pts"
    },
    {
      "name": "Family",
      "formula": "a1×3",
      "unit": "workers"
    },
    {
      "name": "Objectives",
      "explain": "Sum of objective scores",
      "formula": "a1+next"
    },
    {
      "name": "Housing",
      "explain": "Stars multiplied by qty",
      "formula": "a1×a2",
      "subUnits": ["Stars", "Tiles"],
      "color": "Blue"
    },
    {
      "name": "Wheat Fields",
      "explain": "Tiles x Crowns, summed",
      "formula": "(a1×a2)+next",
      "subUnits": ["Tiles", "Crowns"],
      "color": "Green"
    },
    {
      "name": "Wheat Store",
      "explain": "Stepped penalty & bonus",
      "formula": "f1(a1)",
      "unit": "units",
      "functions": {
        "f1": "[0,1,3,+]>[-1,1,2,2]"
      }
    },
    {
      "name": "Central Castle\\nRequirement",
      "explain": "Check if criteria met",
      "formula": "a1",
      "quickActions": "['Yes','No']>[10,0]"
    }
  ]
}
\`\`\`
`;

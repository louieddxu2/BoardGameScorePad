/**
 * Board Game ScorePad — AI Scoring Generator 超頻極簡版提示詞 V4.6
 * 完美落地「節點平移線性累加」極限閉環數學模型，實現多重情境的終極多樣性對齊。
 */

// ============================================================================
// 🧠 繁體中文版 (SYSTEM_PROMPT_ZH)
// ============================================================================
export const SYSTEM_PROMPT_ZH = `# 桌遊計分板轉換器 (Lite)

請依照我提供的桌上遊戲名稱與計分規則圖片，提取出所有計分項目，依照後述的 JSON 格式生成繁體中文的計分板 JSON。

## 輸出格式
純 JSON，無須額外解釋。頂層結構：
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
| \`explain\` | | 簡述計分邏輯，8 字內。 |
| \`formula\` | ✅ | 計分公式。見下方公式表 |
| \`unit\` | | 根據此項目要求使用者輸入數值的量詞。(如：動物為「隻」、卡片數量為「張」，大多物體通用的「個」) |
| \`subUnits\` | | 若用兩數相乘公式，可填寫兩個相乘項目的量詞 |
| \`color\` | | 若規則圖片能明顯判斷此項目的顏色，用下列一種顏色表示：「紅」、「藍」、「黃」、「綠」、「橘」、「紫」、「黑」、「灰」、「褐」 |
| \`quickActions\` | | 若為按鈕選單，寫按鈕標籤與對應數值。見下方公式說明 |
| \`functions\` | | 查表函數定義。見下方公式說明 |

---

## 公式表 (極簡 7 式)
根據項目計分方式選擇公式，優先選擇前 3 種基本公式。乘號務必使用全形 \`×\`。

### 🟢 基礎公式
1. **\`a1\`** (直接數值)：分數是單一來源，無須額外計算或累加。*例：「計分軌分數」*。
2. **\`a1×倍率\`** (倍率計分)：寫作 \`a1×3\` 或 \`a1×(-5)\`。*例：每個工人 3 分寫作 \`a1×3\`*。
3. **\`a1+next\`** (分項累加)：要多次輸入同類分數得出總和的。*例：「每張卡片的分數」*。

### 🟠 進階公式
4. **\`a1×a2\`** (兩數相乘)：兩個數值都需玩家手動輸入。*需搭配 \`subUnits\`，如 \`["個", "星"]\`*。
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

## 完整極簡對齊範例

\`\`\`json
{
  "name": "範例桌遊",
  "columns": [
    {
      "name": "計分軌",
      "formula": "a1",
      "unit": "分"
    },
    {
      "name": "家庭成員",
      "explain": "每人 3 分",
      "formula": "a1×3",
      "unit": "人"
    },
    {
      "name": "發展卡",
      "explain": "每張卡的分數加總",
      "formula": "a1+next"
    },
    {
      "name": "住宅",
      "explain": "住宅數量乘以星數",
      "formula": "a1×a2",
      "subUnits": ["個", "星"],
      "color": "黃"
    },
    {
      "name": "麥田地形",
      "explain": "每塊的格數乘皇冠",
      "formula": "(a1×a2)+next",
      "subUnits": ["格", "冠"],
      "color": "綠"
    },
    {
      "name": "麥子存量",
      "explain": "查表每逾 1 個 2 分",
      "formula": "f1(a1)",
      "unit": "份",
      "functions": {
        "f1": "[0,1,3,+]>[-1,1,2,2]"
      }
    },
    {
      "name": "是否符合\\n中央城堡",
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
export const SYSTEM_PROMPT_EN = \`# Board Game Scoreboard Converter (Lite)

Please extract all scoring items from the game name and rules image provided by me, and generate JSON according to the format below.

## Output Format
Pure JSON, no extra explanation. Top-level structure:
\\\`\\\`\\\`json
{
  "name": "Game Name",
  "columns": [ ... ]
}
\\\`\\\`\\\`

## Column Properties
| Property | Req | Description |
|---|---|---|
| \\\`name\\\` | ✅ | Item name. Shorten to 1-3 words. Use \\\`\\\\n\\\` for wrapping. *Ex: "Longest Road"* |
| \\\`explain\\\` | | Ultra-short logic, under 8 words |
| \\\`formula\\\` | ✅ | Scoring formula. See formula table below |
| \\\`unit\\\` | | Measurement unit for input numbers. (Ex: animal is "pcs", card counts is "cards") |
| \\\`subUnits\\\` | | Labels for multiplied formula inputs |
| \\\`color\\\` | | If clear visually, represent with ONE keyword: "Red", "Blue", "Yellow", "Green", "Orange", "Purple", "Black", "Gray", "Brown" |
| \\\`quickActions\\\` | | For button menu, write label array and score array. See formula table |
| \\\`functions\\\` | | Chart lookup mapping definitions. See below |

---

## Formula Table (7 Modes)
Choose formula based on scoring method, prioritize the first 3. Use full-width \\\`×\\\`.

### 🟢 Basic Formulas
1. **\\\`a1\\\`** (Direct Value): Single point source. *Ex: "Scoretrack Points"*
2. **\\\`a1×multiplier\\\`** (Multiplier): *Ex: Each worker gets 3 pts -> \\\`a1×3\\\`*
3. **\\\`a1+next\\\`** (Accumulator): For items requiring multiple entries. *Ex: "Score for each individual card"*

### 🟠 Advanced Formulas
4. **\\\`a1×a2\\\`** (Multiplication): Both inputs manual. *Requires \\\`subUnits\\\`, e.g., \\\`["Pcs", "Stars"]\\\`*
5. **\\\`(a1×a2)+next\\\`** (Accumulated Multiplications): Multiple [Tiles × Crowns] logged step-by-step.
6. **\\\`f1(a1)\\\`** (Chart Lookup): Step function mapping. Write \\\`[count]>[points]\\\` in \\\`functions.f1\\\`.
7. **\\\`a1\\\`** + Buttons (Button Menu): Write \\\`['Label']>[points]\\\` in \\\`quickActions\\\`.

---

## Full Ground Truth Example

\\\`\\\`\\\`json
{
  "name": "Sample Game",
  "columns": [
    {
      "name": "Scoretrack",
      "formula": "a1",
      "unit": "pts"
    },
    {
      "name": "Family",
      "explain": "3 pts per person",
      "formula": "a1×3",
      "unit": "workers"
    },
    {
      "name": "Objectives",
      "explain": "Sum of card scores",
      "formula": "a1+next"
    },
    {
      "name": "Housing",
      "explain": "Qty multiplied by Stars",
      "formula": "a1×a2",
      "subUnits": ["Pcs", "Stars"],
      "color": "Yellow"
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
      "explain": "Chart: 2 pts per extra",
      "formula": "f1(a1)",
      "unit": "units",
      "functions": {
        "f1": "[0,1,3,+]>[-1,1,2,2]"
      }
    },
    {
      "name": "Central Castle\\\\nRequirement",
      "formula": "a1",
      "quickActions": "['Yes','No']>[10,0]"
    }
  ]
}
\\\`\\\`\\\`
\`;

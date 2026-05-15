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
| \`color\` | | 若規則圖片能明顯判斷此項目的顏色，用下列一種顏色表示：「紅」、「藍」、「黃」、「綠」、「橘」、「紫」、「黑」、「灰」、「褐」 |
| \`formula\` | ✅ | 計分公式。見下方公式表 |
| \`unit\` | | 根據此項目要求使用者輸入數值的量詞。(如：動物為「隻」、卡片數量為「張」，大多物體通用的「個」) |
| \`subUnits\` | | 若用兩數相乘公式，可填寫兩個相乘項目的量詞 |

---

## 公式表 (極簡 7 式)
根據項目計分方式選擇公式，優先選擇前 3 種基本公式。

### 🟢 基礎公式
1. **\`x\`** (直接數值)：分數是單一來源，無須額外計算或累加。*例：「計分軌分數」*。
2. **\`3x\` / \`(1/2)x\`** (倍率計分)：*例：每個工人 3 分寫作 \`3x\`*。
3. **\`x+next\`** (分項累加)：要多次輸入同類分數得出總和的。*例：「每張卡片的分數」*。

### 🟠 進階公式
4. **\`xy\`** (兩數相乘)：兩個數值都需玩家手動輸入。*需搭配 \`subUnits\`，如 \`["個", "星"]\`*。
5. **\`xy+next\`** (相乘後累加)：多組 [數量 × 乘數] 需要分次累加。
6. **\`lookup[...]\`** (查表計分)：階梯分數。將條件與分數相鄰寫入括號中。
   *例 1：1~2個1分，3~5個3分，6個以上固定8分，記為：*
   \`lookup[1~2->1, 3~5->3, 6+->8]\`
   *例 2：0個-1分，1~2個1分，3~5個3分，6個得6分，超過6個每多2個多5分，記為：*
   \`lookup[0->-1, 1~2->1, 3~5->3, 6->6, +2->5]\`
7. **\`buttons[...]\`** (按鈕選單)：將選項標籤用單引號包裝並指定分數。
   *例：是=10分, 否=0分 記為：*
   \`buttons['是'->10, '否'->0]\`

---

## 完整範例

\`\`\`json
{
  "name": "範例桌遊",
  "columns": [
    {
      "name": "計分軌",
      "formula": "x",
      "unit": "分"
    },
    {
      "name": "家庭成員",
      "formula": "3x",
      "unit": "人"
    },
    {
      "name": "發展卡",
      "formula": "x+next"
    },
    {
      "name": "住宅",
      "formula": "xy",
      "subUnits": ["個", "星"],
      "color": "綠"
    },
    {
      "name": "麥田地形",
      "formula": "xy+next",
      "subUnits": ["格", "冠"],
      "color": "黃"
    },
    {
      "name": "麥子存量",
      "formula": "lookup[0->-1, 1->1, 3->2, +1->2]",
      "unit": "份",
      "color": "黃"
    },
    {
      "name": "是否符合\\n中央城堡",
      "formula": "buttons['是'->10, '否'->0]"
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
Pure JSON, no extra explanation. Top-level structure:
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
| \`color\` | | If clear visually, represent with ONE keyword: "Red", "Blue", "Yellow", "Green", "Orange", "Purple", "Black", "Gray", "Brown" |
| \`formula\` | ✅ | Scoring formula. See formula table below |
| \`unit\` | | Measurement unit for input numbers. (Ex: animal is "pcs", card counts is "cards") |
| \`subUnits\` | | Labels for multiplied formula inputs |

---

## Formula Table (7 Modes)
Choose formula based on scoring method, prioritize the first 3.

### 🟢 Basic Formulas
1. **\`x\`** (Direct Value): Single point source. *Ex: "Scoretrack Points"*
2. **\`3x\` / \`(1/2)x\`** (Multiplier): *Ex: Each worker gets 3 pts -> \`3x\`*
3. **\`x+next\`** (Accumulator): For items requiring multiple entries. *Ex: "Score for each individual card"*

### 🟠 Advanced Formulas
4. **\`xy\`** (Multiplication): Both inputs manual. *Requires \`subUnits\`, e.g., \`["Pcs", "Stars"]\`*
5. **\`xy+next\`** (Accumulated Multiplications): Multiple [Tiles × Crowns] logged step-by-step.
6. **\`lookup[...]\`** (Chart Lookup): Step function mapping. Write range conditions and scores together.
   *Ex 1: 1~2 is 1 pt, 3~5 is 3 pts, 6+ is 8 pts -> \`lookup[1~2->1, 3~5->3, 6+->8]\`*
   *Ex 2: 0 is -1, 1~2 is 1, 3~5 is 3, each +2 is 5 pts -> \`lookup[0->-1, 1~2->1, 3~5->3, 6->6, +2->5]\`*
7. **\`buttons[...]\`** (Button Menu): Wrap labels in single quotes and map to scores.
   *Ex: Yes=10 pts, No=0 pts -> \`buttons['Yes'->10, 'No'->0]\`*

---

## Full Example

\`\`\`json
{
  "name": "Sample Game",
  "columns": [
    {
      "name": "Scoretrack",
      "formula": "x",
      "unit": "pts"
    },
    {
      "name": "Family",
      "formula": "3x",
      "unit": "workers"
    },
    {
      "name": "Objectives",
      "formula": "x+next"
    },
    {
      "name": "Housing",
      "formula": "xy",
      "subUnits": ["Pcs", "Stars"],
      "color": "Green"
    },
    {
      "name": "Wheat Fields",
      "formula": "xy+next",
      "subUnits": ["Tiles", "Crowns"],
      "color": "Yellow"
    },
    {
      "name": "Wheat Store",
      "formula": "lookup[0->-1, 1->1, 3->2, +1->2]",
      "unit": "units",
      "color": "Yellow"
    },
    {
      "name": "Central Castle\\nRequirement",
      "formula": "buttons['Yes'->10, 'No'->0]"
    }
  ]
}
\`\`\`
`;

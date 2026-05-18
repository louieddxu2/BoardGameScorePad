const { inflateGameTemplate } = require('../src/features/ai-generator/services/aiExpander');

const mockAiOutput = [
    { name: "當前分數", formula: "x" },
    { name: "工人", formula: "3x" }
];

const mockGameName = "農家樂";

console.log("--- 測試開始 ---");
console.log("AI 原始輸出 (純陣列):", JSON.stringify(mockAiOutput, null, 2));

const inflated = inflateGameTemplate(mockAiOutput);

console.log("\n膨脹後結果 (未補回名稱):", JSON.stringify(inflated, null, 2));

if (!inflated.name) {
    console.log("\n⚠️ 發現名稱缺失，正在模擬補回邏輯...");
    inflated.name = mockGameName;
}

console.log("\n最終結果 (已補回名稱):", JSON.stringify(inflated, null, 2));

if (inflated.name === mockGameName && Array.isArray(inflated.columns) && inflated.columns.length === 2) {
    console.log("\n✅ 測試通過：成功將純陣列膨脹並補回名稱。");
} else {
    console.log("\n❌ 測試失敗。");
}

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GameTemplate, ScoreColumn, SelectOption } from "../types";

// The API key is injected via vite.config.ts define
const apiKey = process.env.API_KEY;

// Initialize without API key if missing, handle error at call site
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const templateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "桌遊名稱",
    },
    description: {
      type: Type.STRING,
      description: "計分規則簡述",
    },
    columns: {
      type: Type.ARRAY,
      description: "計分欄位列表 (在表格中將呈現為列)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "計分項目名稱 (例如: '金幣', '軍事力')" },
          type: { 
            type: Type.STRING, 
            enum: ["number", "text", "select", "boolean"],
            description: "資料輸入類型" 
          },
          options: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT,
                properties: {
                    value: { type: Type.NUMBER, description: "此選項代表的分數數值" },
                    label: { type: Type.STRING, description: "此選項的文字說明 (例如: '3個以上')" }
                },
                required: ["value", "label"]
            },
            description: "如果類型是 'select'，此處為選項列表。每個選項包含分數(value)和說明(label)。"
          },
          isScoring: { 
            type: Type.BOOLEAN, 
            description: "此項目是否計入總分" 
          },
          weight: {
            type: Type.NUMBER,
            description: "分數權重 (通常為 1，扣分為 -1)",
          }
        },
        required: ["name", "type", "isScoring"],
      },
    },
  },
  required: ["name", "columns"],
};

export const generateTemplate = async (gameName: string): Promise<Partial<GameTemplate> | null> => {
  if (!ai) {
    console.error("API Key missing");
    alert("尚未設定 API Key。請在專案設定的 .env 檔案中加入 VITE_API_KEY=您的金鑰");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `請為桌遊 "${gameName}" 建立一個詳細的計分模板。
      請使用**繁體中文 (Traditional Chinese)** 回覆。
      分析遊戲規則以確定需要追蹤的項目。
      包含計分項目（分數）和非計分欄位（如筆記、陣營選擇）。
      如果是扣分項目，請確保 'weight' 為負數。
      對於 'select' (查表計分) 類型的欄位，請務必提供 options，其中 value 是分數，label 是條件說明。
      請將每一個計分步驟拆解為獨立的項目。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: templateSchema,
        temperature: 0.3, 
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    
    // Map to our internal structure (adding IDs)
    const columns: ScoreColumn[] = data.columns.map((col: any) => ({
      ...col,
      id: crypto.randomUUID(),
      weight: col.weight ?? 1,
    }));

    return {
      name: data.name,
      description: data.description,
      columns: columns,
    };

  } catch (error) {
    console.error("Gemini generation error:", error);
    alert("AI 生成失敗，請稍後再試或檢查 API Quota。");
    throw error;
  }
};
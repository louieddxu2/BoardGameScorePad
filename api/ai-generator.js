// api/ai-generator.js (Vercel Node.js Serverless)
// 升級為 Node.js Runtime 以支援 60 秒超長時限 (maxDuration)

export const maxDuration = 60; // 🚀 關鍵：將超時上限提升至 60 秒 (Hobby 計畫上限)

export default async function handler(req) {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 從 Vercel 環境變數中讀取 Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('Backend configuration missing: GEMINI_API_KEY', { status: 500 });
  }

  try {
    // 1. 解析從瀏覽器前端傳來的 FormData (Node.js 18+ 支援 Web Request API)
    const formData = await req.formData();
    const systemPrompt = formData.get('systemPrompt');
    const gameName = formData.get('gameName');
    const language = formData.get('language');

    // 動態取得使用者選擇的模型，預設為極速版 Lite
    const requestedModel = formData.get('modelName') || 'gemini-2.5-flash-lite';

    // 2. 提取所有圖片檔案，並轉換為 Base64 (Node.js 優化版)
    const geminiParts = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        const buffer = await value.arrayBuffer();
        
        // ⚡ Node.js 效能優化：改用 Buffer 直接轉換，避免 Edge Runtime 的手動迴圈拼接
        const base64 = Buffer.from(buffer).toString('base64');

        geminiParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64
          }
        });
      }
    }

    // 3. 加入最終文字指引，注入動態資訊
    geminiParts.push({
      text: `這是桌遊「${gameName}」的計分頁，請分析圖片並以「${language}」回傳計分板 JSON 結構。若圖片無關，請將 columns 欄位留空。`
    });

    // 4. 組建標準 Gemini REST API Request
    const apiRequestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { parts: geminiParts }
      ],
      generationConfig: {
        responseMimeType: "application/json", // 🌟 絕對防禦：強迫 AI 只能吐出合法 JSON
        temperature: 0.1 // 降低隨機性
      }
    };

    // 5. 動態切換 Google Gemini 模型 API URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });

    // 特判 429 (Rate Limit)，前端會接住並顯示溫馨提示
    if (apiResponse.status === 429) {
      return new Response('Rate Limit Exceeded', { status: 429 });
    }

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      return new Response(`Gemini API error: ${errorBody}`, { status: apiResponse.status });
    }

    const geminiResult = await apiResponse.json();

    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(JSON.stringify({ error: 'AI generated empty response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 🌟 智慧升級：將文字轉譯為 JSON 物件，並連同 usageMetadata 包裝回拋給前端，激活 Token 牌價看板！
    try {
      const parsedData = JSON.parse(generatedText);
      const usage = geminiResult.usageMetadata; // 包含 promptTokenCount, candidatesTokenCount, totalTokenCount
      
      return new Response(JSON.stringify({
        data: parsedData,
        usage: usage || undefined
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      // 🛡️ 絕對防禦：如果 JSON 轉換意外失敗，原封不動地回拋裸 JSON 以保持最大限度的相容性
      return new Response(generatedText, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[Serverless API Error]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

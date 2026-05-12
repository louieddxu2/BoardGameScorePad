
// api/ai-generator.js (Vercel Edge Runtime)
// 這個檔案會自動被 Vercel 識別為後端 API 路由，對應路徑為 /api/ai-generator

export const config = {
  runtime: 'edge',
};

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
    // 1. 解析從瀏覽器前端傳來的 FormData
    const formData = await req.formData();
    const systemPrompt = formData.get('systemPrompt');
    const gameName = formData.get('gameName');
    const language = formData.get('language');

    // 2. 提取所有圖片檔案，並高效轉換為 Base64 供 Google API 使用
    const geminiParts = [];
    
    for (const [key, value] of formData.entries()) {
      // 我們在前端是命名為 image_0, image_1...
      if (key.startsWith('image_') && value instanceof File) {
        const buffer = await value.arrayBuffer();
        // 利用原生 Uint8Array 將二進位轉為 Base64 字串
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
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

    // 5. 呼叫 Google Gemini 1.5 Flash API (使用穩定版 v1 避免 404)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
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

    // 6. 取得 AI 生成的 JSON 字串並直接回拋給前端
    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      return new Response(JSON.stringify({ error: 'AI generated empty response' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 將 JSON 原封不動地傳回您的手機 App
    return new Response(generatedText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Serverless API Error]', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

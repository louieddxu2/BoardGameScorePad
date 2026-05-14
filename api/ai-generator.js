
// api/ai-generator.js (Vercel Node.js Serverless)
// 使用 formidable 確保在 Node.js 環境下穩定解析圖片上傳
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const maxDuration = 60; // 🚀 提升超時上限至 60 秒

// 停用 Vercel 預設的 body parser，因為我們需要自行使用 formidable 解析 multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Backend configuration missing: GEMINI_API_KEY' });
  }

  // 1. 使用 formidable 解析上傳的資料與圖片
  const form = new IncomingForm();
  
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    // 提取文字欄位 (formidable v3 回傳可能是陣列)
    const getFirst = (val) => Array.isArray(val) ? val[0] : val;
    const systemPrompt = getFirst(fields.systemPrompt);
    const gameName = getFirst(fields.gameName);
    const language = getFirst(fields.language);
    const requestedModel = getFirst(fields.modelName) || 'gemini-2.5-flash-lite';

    // 2. 處理圖片檔案
    const geminiParts = [];
    
    // 遍歷所有上傳的檔案
    for (const key in files) {
      if (key.startsWith('image_')) {
        const file = Array.isArray(files[key]) ? files[key][0] : files[key];
        if (file && file.filepath) {
          const buffer = fs.readFileSync(file.filepath);
          const base64 = buffer.toString('base64');

          geminiParts.push({
            inlineData: {
              mimeType: file.mimetype || "image/jpeg",
              data: base64
            }
          });
        }
      }
    }

    // 3. 加入最終文字指引
    geminiParts.push({
      text: `這是桌遊「${gameName}」的計分頁，請分析圖片並以「${language}」回傳計分板 JSON 結構。若圖片無關，請將 columns 欄位留空。`
    });

    // 4. 組建 Gemini Request
    const apiRequestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{ parts: geminiParts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });

    if (apiResponse.status === 429) {
      return res.status(429).send('Rate Limit Exceeded');
    }

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      return res.status(apiResponse.status).send(`Gemini API error: ${errorBody}`);
    }

    const geminiResult = await apiResponse.json();
    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    // 🌟 診斷強化：如果 AI 輸出為空（可能是被 Safety Filter 攔截），將完整結果打包回傳
    if (!generatedText) {
      return res.status(200).json({ 
        error: 'json_parse_failed', 
        rawResponse: 'AI 回傳內容為空 (可能是被 Google 安全過濾器攔截)',
        parseErrorMessage: `Full API Response: ${JSON.stringify(geminiResult)}`
      });
    }

    // 🌟 診斷強化：清理 Markdown 標籤並嘗試解析
    try {
      // 移除 AI 可能夾帶的 ```json 或 ``` 標籤
      const cleanJson = generatedText.replace(/```json\n?|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      const usage = geminiResult.usageMetadata;
      
      return res.status(200).json({
        data: parsedData,
        usage: usage || undefined
      });
    } catch (parseError) {
      // 🛡️ 診斷透傳：如果解析失敗，回傳 200 並帶上原始文字，方便前端校稿
      console.error('[JSON Parse Error]', parseError);
      return res.status(200).json({
        error: 'json_parse_failed',
        rawResponse: generatedText,
        parseErrorMessage: parseError.message
      });
    }

  } catch (error) {
    console.error('[Serverless Node.js API Error]', error);
    // 🛡️ 最終診斷保障：即使後端崩潰，也將錯誤訊息打包回傳，讓前端診斷 UI 能捕捉
    return res.status(200).json({ 
      error: 'server_error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// api/ai-generator.js (Vercel Edge Function)
import { SYSTEM_PROMPT_ZH, SYSTEM_PROMPT_EN } from './aiSystemPrompt.js';

export const config = {
  runtime: 'edge',
};

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemma-3-27b-it',
]);

function resolveModel(modelName) {
  const requestedModel = typeof modelName === 'string' ? modelName : DEFAULT_MODEL;
  return ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
}

function resolveSystemPrompt(language) {
  const requestedLanguage = typeof language === 'string' ? language : '';
  return requestedLanguage.toLowerCase().includes('zh') ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
}

// ArrayBuffer 轉 Base64 函數 (Edge runtime 適用，無相依套件)
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export default async function handler(req) {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Backend configuration missing: GEMINI_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. 使用原生的 req.formData() 解析上傳的資料與圖片
    const formData = await req.formData();
    
    const gameName = formData.get('gameName');
    const language = formData.get('language');
    const requestedModel = resolveModel(formData.get('modelName'));
    const systemPrompt = resolveSystemPrompt(language);

    // 2. 處理圖片檔案
    const geminiParts = [];
    
    // 遍歷所有 FormData 中的 image_ 開頭欄位
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        const arrayBuffer = await value.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        
        geminiParts.push({
          inlineData: {
            mimeType: value.type || "image/jpeg",
            data: base64
          }
        });
      }
    }

    // 3. 加入最終文字指引
    geminiParts.push({
      text: `這是桌遊「${gameName}」的計分頁，請分析圖片並以「${language}」回傳計分板 JSON 結構。若圖片無關，請將 columns 欄位留空。`
    });

    const isGemma = requestedModel.toLowerCase().includes('gemma');

    // 4. 組建 Gemini Request
    const apiRequestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{ parts: geminiParts }],
      generationConfig: {
        ...(isGemma ? {} : { responseMimeType: "application/json" }),
        temperature: 0.1
      }
    };

    // 🌟 改用 streamGenerateContent 串流端點
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });

    if (apiResponse.status === 429) {
      return new Response('Rate Limit Exceeded', { status: 429 });
    }

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      return new Response(`Gemini API error: ${errorBody}`, { status: apiResponse.status });
    }

    // 🌟 將 Gemini 回傳的 EventStream 原封不動地 pipe 回前端
    return new Response(apiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('[Edge API Error]', error);
    // 🛡️ 錯誤診斷
    return new Response(
      JSON.stringify({ 
        error: 'server_error', 
        message: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

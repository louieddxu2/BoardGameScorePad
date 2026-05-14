
// api/ai-generator.js (Vercel Node.js Serverless)
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Backend configuration missing: GEMINI_API_KEY' });

  const form = new IncomingForm();
  
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const getFirst = (val) => Array.isArray(val) ? val[0] : val;
    const systemPrompt = getFirst(fields.systemPrompt);
    const gameName = getFirst(fields.gameName);
    const language = getFirst(fields.language);
    const requestedModel = getFirst(fields.modelName) || 'gemini-2.5-flash-lite';

    const geminiParts = [];
    for (const key in files) {
      if (key.startsWith('image_')) {
        const file = Array.isArray(files[key]) ? files[key][0] : files[key];
        if (file && file.filepath) {
          const buffer = fs.readFileSync(file.filepath);
          const base64 = buffer.toString('base64');
          geminiParts.push({ inlineData: { mimeType: file.mimetype || "image/jpeg", data: base64 } });
        }
      }
    }

    geminiParts.push({
      text: `這是桌遊「${gameName}」的計分頁，請分析圖片並以「${language}」回傳計分板 JSON 結構。若圖片無關，請將 columns 欄位留空。`
    });

    const apiRequestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: geminiParts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`;
    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      return res.status(apiResponse.status).send(`Gemini API error: ${errorBody}`);
    }

    const geminiResult = await apiResponse.json();
    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return res.status(200).json({ error: 'json_parse_failed', rawResponse: 'AI generated empty response' });
    }

    try {
      const cleanJson = generatedText.replace(/```json\n?|```/g, '').trim();
      let parsedData = JSON.parse(cleanJson);
      
      // 🌟 核心修正：回歸最簡化對齊邏輯
      if (parsedData.columns) {
        parsedData.columns = parsedData.columns.map(col => {
          let formula = col.formula || 'a1';
          
          // 1. 僅做符號轉換：將全形 × 轉為半形 *
          formula = formula.replace(/×/g, '*');

          // 2. 處理按鈕選單 (['標籤']>[數值] ➔ actions(a1, actions))
          if (col.quickActions && typeof col.quickActions === 'string' && col.quickActions.includes('>')) {
            try {
              const [labelsPart, valuesPart] = col.quickActions.split('>');
              const labels = JSON.parse(labelsPart.replace(/'/g, '"'));
              const values = JSON.parse(valuesPart);
              col.actions = labels.map((label, idx) => ({ label, value: values[idx] }));
              formula = `actions(a1, actions)`;
              delete col.quickActions;
            } catch (e) { /* ignore */ }
          }
          
          return { ...col, formula };
        });
      }
      
      return res.status(200).json({ data: parsedData, usage: geminiResult.usageMetadata });
    } catch (parseError) {
      return res.status(200).json({ error: 'json_parse_failed', rawResponse: generatedText });
    }
  } catch (error) {
    return res.status(200).json({ error: 'server_error', message: error.message });
  }
}

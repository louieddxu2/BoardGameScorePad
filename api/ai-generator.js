
// api/ai-generator.js (Vercel Node.js Serverless)
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const maxDuration = 60;

export const config = { api: { bodyParser: false } };

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
          const base64 = fs.readFileSync(file.filepath).toString('base64');
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

    if (!apiResponse.ok) return res.status(apiResponse.status).send(`Gemini Error: ${await apiResponse.text()}`);

    const geminiResult = await apiResponse.json();
    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) return res.status(200).json({ error: 'json_parse_failed' });

    try {
      const cleanJson = generatedText.replace(/```json\n?|```/g, '').trim();
      let parsedData = JSON.parse(cleanJson);
      
      // 🚀 核心對齊邏輯 (Expansion to Frontend Engine)
      if (parsedData.columns) {
        parsedData.columns = parsedData.columns.map(col => {
          let formula = col.formula || 'a1';
          
          // 1. 處理倍率計分 (對齊 calculateColumnScore 的 === 'a1×c1' 邏輯)
          const multiMatch = formula.match(/[×\*]\(?(-?\d+(\.\d+)?)\)?/);
          if (multiMatch) {
            const val = multiMatch[1];
            formula = 'a1×c1'; // 強制對齊全形字串
            col.constants = { c1: parseFloat(val) };
          }

          // 2. 處理查表計分 (對齊 col.f1 欄位預期)
          if (col.functions && col.functions.f1) {
            // 將 AI 產生的 Map 格式還原為前端的 MappingRule 陣列
            // 由於 AI 是照樣版輸出的，這裡保持 formula 開頭為 f1 即可觸發引擎
            col.f1 = col.functions.f1; 
          }

          // 3. 處理按鈕選單 (轉換為 actions 格式)
          if (col.quickActions && typeof col.quickActions === 'string' && col.quickActions.includes('>')) {
            try {
              const [labelsPart, valuesPart] = col.quickActions.split('>');
              const labels = JSON.parse(labelsPart.replace(/'/g, '"'));
              const values = JSON.parse(valuesPart);
              col.quickActions = labels.map((label, idx) => ({ 
                id: `opt_${idx}`, 
                label, 
                value: values[idx] 
              }));
              formula = 'a1'; // 按鈕選單在前端引擎會被 detect 為 clicker 並處理
              col.inputType = 'clicker';
            } catch (e) {}
          }
          
          return { ...col, formula };
        });
      }
      
      return res.status(200).json({ data: parsedData });
    } catch (parseError) {
      return res.status(200).json({ error: 'json_parse_failed', rawResponse: generatedText });
    }
  } catch (error) {
    return res.status(200).json({ error: 'server_error', message: error.message });
  }
}

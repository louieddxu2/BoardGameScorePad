
import { useTranslation } from './index';

export const aiGeneratorTranslations = {
    'zh-TW': {
        title: "AI 生成計分板",
        privacy_warning: "此照片將傳送至 Google Gemini AI 進行辨識，請勿上傳隱私內容。",
        prompt_question: "是否要拍攝「規則書計分頁」來自動建立詳細計分板？",
        btn_start_direct: "不必了，直接開始",
        btn_start_ai: "拍照建立",
        btn_take_photo: "拍照",
        btn_upload_image: "選取相片",
        status_compressing: "圖片高速優化中...",
        status_generating: "AI 辨識規則書中...",
        status_success: "計分板解析成功！",
        error_rate_limit: "系統現在太忙了 (429)，請過 1 分鐘後再試試！",
        error_generic: "辨識失敗，請確認網路連線或照片清晰度後重試。",
        error_invalid_json: "AI 解析出的結構不正確，請換個角度再試一次。",
    },
    'en': {
        title: "AI Scoreboard Generator",
        privacy_warning: "Photo will be sent to Google Gemini AI. Avoid uploading private content.",
        prompt_question: "Would you like to photo the rulebook to auto-generate a detailed board?",
        btn_start_direct: "No, start directly",
        btn_start_ai: "Photo & Scan",
        btn_take_photo: "Take Photo",
        btn_upload_image: "Upload Photo",
        status_compressing: "Optimizing image...",
        status_generating: "AI analyzing rulebook...",
        status_success: "Scoreboard generated!",
        error_rate_limit: "System busy (429), please retry in a minute!",
        error_generic: "Analysis failed, please check photo clarity and retry.",
        error_invalid_json: "AI produced invalid structure, please try another angle.",
    }
};

export type AiGeneratorTranslationKey = keyof typeof aiGeneratorTranslations['zh-TW'];

export const useAiGeneratorTranslation = () => {
    const { language } = useTranslation();
    const t = (key: AiGeneratorTranslationKey) => {
        const dict = aiGeneratorTranslations[language] || aiGeneratorTranslations['zh-TW'];
        return dict[key] || key;
    };
    return { t, language };
};

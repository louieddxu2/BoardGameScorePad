
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
        model_lite: "🏎️ 極速 Lite",
        model_standard: "🧠 精準 Std",
        btn_clear_all: "全部清除",
        btn_add_photo: "追加照片",
        btn_add_from_album: "追加相簿照片",
        status_selected_count: "已選取 {count} 張相片",
        btn_analyze_count: "開始分析這 {count} 張相片",
        status_token_cost: "💸 消耗 NT$ {cost} 元",
        status_token_count: "({count} Tokens 消耗)",
        label_column_count: "欄位總數",
        label_quick_actions: "快速操作項",
        label_ai_ready: "🎉 AI 已經準備好您的遊戲記分板！",
        btn_use_this_template: "🚀 使用此計分板開始遊戲",
        btn_reanalyze: "重新辨識 / 返回上一步",
        scheme_plain: "直接數值 (純數)",
        scheme_rate: "固定倍率 (倍率)",
        scheme_accum: "分項累加",
        scheme_product: "兩數相乘",
        scheme_prod_accum: "兩數相乘分項累加",
        scheme_lookup: "查表計分 (範圍)",
        scheme_list: "按鈕選單 (列表)",
        scheme_count_suffix: "{count} 項",
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
        model_lite: "🏎️ Turbo Lite",
        model_standard: "🧠 Precise Std",
        btn_clear_all: "Clear All",
        btn_add_photo: "Add Photo",
        btn_add_from_album: "Add from Album",
        status_selected_count: "Selected {count} photos",
        btn_analyze_count: "Analyze {count} Photos",
        status_token_cost: "💸 Cost NT$ {cost}",
        status_token_count: "({count} Tokens Used)",
        label_column_count: "Columns Count",
        label_quick_actions: "Quick Actions",
        label_ai_ready: "🎉 AI has prepared your scoreboard!",
        btn_use_this_template: "🚀 Use this Board to Play",
        btn_reanalyze: "Re-scan / Go Back",
        scheme_plain: "Direct Value (Plain)",
        scheme_rate: "Fixed Rate (Multiplier)",
        scheme_accum: "Item Summation",
        scheme_product: "Two-number Product",
        scheme_prod_accum: "Product Accumulation",
        scheme_lookup: "Scale Lookup (Table)",
        scheme_list: "Button Menu (List)",
        scheme_count_suffix: "{count} items",
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

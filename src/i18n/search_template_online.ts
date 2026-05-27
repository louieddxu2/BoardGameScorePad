import { useTranslation } from './index';

export const searchTemplateOnlineTranslations = {
    'zh-TW': {
        search_online_title: "🔍 在線尋找計分範本",
        search_online_prompt: "偵測到此遊戲目前為「簡易計分板」，您可以選擇：",
        search_online_btn_direct: "⚡ 簡易計分",
        search_online_btn_ai: "📸 AI 掃描",
        search_online_loading: "正在背景尋找雲端社群計分板...",
        search_online_offline: "離線狀態下，直接進入簡易計分板。",
        search_online_empty_title: "目前雲端尚無此遊戲的計分板",
        search_online_empty_desc: "別擔心！您可以使用下方的 AI 拍照生成，或直接使用簡易計分。",
        search_online_error_title: "無法連線至在線範本庫",
        search_online_error_desc: "請檢查您的網路連線，或直接使用下方簡易計分起步。",
        search_online_tip_desc: "💡 由社群創作者分享的結構化計分板，一鍵直接下載啟用。",
        search_online_btn_download: "下載並使用此計分板",
        search_online_btn_downloaded: "已下載 (點擊套用)",
        search_online_badge_owned: "已下載",
        search_online_btn_view_detail: "🔍 查看預覽",
        search_online_btn_view_catalog: "📁 查看所有版本",
        search_online_btn_back_detail: "📄 返回推薦版本",
        search_online_columns_suffix: " 欄位",
        search_online_more_versions: "還有 {count} 個版本可用",
        search_online_btn_back: "⬅️ 返回推薦版本",
        formula_label_auto: "自動計算",
        formula_label_button_multi: "按鈕多選",
        formula_label_button_addition: "按鈕累加",
        formula_label_button: "按鈕單選",
        formula_label_table: "範圍查表",
        formula_label_subtraction: "倍率扣分",
        formula_label_product_addition: "相乘累加",
        formula_label_product: "兩數相乘",
        formula_label_addition: "分項累加",
        formula_label_multiplier: "固定倍率",
        formula_label_plain: "直接輸入",
    },
    'en': {
        search_online_title: "🔍 Search Templates Online",
        search_online_prompt: "This game is currently a \"Simple Scorepad\". You can choose to:",
        search_online_btn_direct: "⚡ Simple",
        search_online_btn_ai: "📸 AI Scan",
        search_online_loading: "Searching background cloud templates...",
        search_online_offline: "Offline, launching simple scorepad.",
        search_online_empty_title: "No templates available on cloud yet",
        search_online_empty_desc: "No worries! You can use AI scan below or start directly with a simple scorepad.",
        search_online_error_title: "Unable to connect to Online Library",
        search_online_error_desc: "Please check your internet connection, or start directly with a simple scorepad.",
        search_online_tip_desc: "💡 Structured scorepad shared by the community. One-click to download and launch.",
        search_online_btn_download: "Download & Use This Scorepad",
        search_online_btn_downloaded: "Downloaded (Apply)",
        search_online_badge_owned: "Downloaded",
        search_online_btn_view_detail: "🔍 View Preview",
        search_online_btn_view_catalog: "📁 View All Versions",
        search_online_btn_back_detail: "📄 Back to Recommended",
        search_online_columns_suffix: " cols",
        search_online_more_versions: "{count} more versions available",
        search_online_btn_back: "⬅️ Back to Recommended",
        formula_label_auto: "Auto",
        formula_label_button_multi: "Btn-Mul",
        formula_label_button_addition: "Btn-Add",
        formula_label_button: "Btn-Sgl",
        formula_label_table: "Lookup",
        formula_label_subtraction: "Sub",
        formula_label_product_addition: "Prod-Add",
        formula_label_product: "Product",
        formula_label_addition: "Add",
        formula_label_multiplier: "Mult",
        formula_label_plain: "Plain",
    }
};

export type SearchTemplateOnlineTranslationKey = keyof typeof searchTemplateOnlineTranslations['zh-TW'];

export const useSearchTemplateOnlineTranslation = () => {
    const { language } = useTranslation();
    const t = (key: SearchTemplateOnlineTranslationKey, params?: Record<string, string | number>) => {
        const dict = searchTemplateOnlineTranslations[language] || searchTemplateOnlineTranslations['zh-TW'];
        let text = dict[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };
    return { t, language };
};

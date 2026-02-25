import { useTranslation } from './index';

export const templateEditorTranslations = {
    'zh-TW': {
        tmpl_new_title: "建立新計分板",
        tmpl_edit_title: "編輯模板",
        tmpl_name_label: "計分板名稱",
        tmpl_name_ph: "例如：卡坦島、璀璨寶石...",
        tmpl_default_name: "自訂計分板",
        tmpl_col_count_label: "計分項目數量",
        tmpl_no_total: "(不含總分)",
        tmpl_col_unit: "列",
        tmpl_col_default_name: "項目 {n}",
        tmpl_simple_mode: "簡易模式：僅顯示玩家與總分，適合單純記錄勝負。",
        tmpl_desc_simple: "簡易計數器",
        tmpl_desc_columns: "{count} 個計分項目",
        tmpl_btn_img: "建立圖片計分板",
        tmpl_btn_std: "建立一般計分板",
        tmpl_hint: "提示：建立後，您仍可以在計分表中點擊標題來修改所有細節。",
        tmpl_save_warn: "請輸入計分板名稱",
        tmpl_scan_warn: "請先輸入計分板名稱",
        tmpl_img_save_fail: "圖片儲存失敗，請重試",
    },
    'en': {
        tmpl_new_title: "New Score Sheet",
        tmpl_edit_title: "Edit Template",
        tmpl_name_label: "Board Name",
        tmpl_name_ph: "e.g. Catan, Splendor...",
        tmpl_default_name: "Custom Board",
        tmpl_col_count_label: "Item Count",
        tmpl_no_total: "(Excl. Total)",
        tmpl_col_unit: "col",
        tmpl_col_default_name: "Item {n}",
        tmpl_simple_mode: "Simple Mode: Only show Players and Total Score.",
        tmpl_desc_simple: "Simple Counter",
        tmpl_desc_columns: "{count} scoring items",
        tmpl_btn_img: "Create from Image",
        tmpl_btn_std: "Create Standard",
        tmpl_hint: "Tip: You can edit details later by clicking headers in the sheet.",
        tmpl_save_warn: "Please enter a name",
        tmpl_scan_warn: "Please enter a name first",
        tmpl_img_save_fail: "Failed to save image, please try again",
    }
};

export type TemplateEditorTranslationKey = keyof typeof templateEditorTranslations['zh-TW'];

export const useTemplateEditorTranslation = () => {
    const { language } = useTranslation();
    const t = (key: TemplateEditorTranslationKey, params?: Record<string, string | number>) => {
        const dict = templateEditorTranslations[language] || templateEditorTranslations['zh-TW'];
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

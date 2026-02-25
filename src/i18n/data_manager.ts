import { useTranslation } from './index';

export const dataManagerTranslations = {
    'zh-TW': {
        data_mgr_title: "資料管理",
        data_import_tab: "匯入資料",
        data_export_tab: "匯出分享",
        data_import_ph: "請貼上其他裝置分享的 JSON 資料：",
        data_import_btn: "匯入至我的遊戲庫",
        data_export_hint: "選擇要匯出的遊戲：",
        data_export_empty: "沒有可匯出的自訂遊戲或修改紀錄",
        data_builtin_mod: "內建修改",
        data_selected_count: "已選 {count} 個",
        data_select_all: "全選",
        data_deselect_all: "取消全選",
        data_copy_json: "複製 JSON",
        data_mail_dev: "投稿給開發者",
        data_copy_success: "複製成功",
        data_export_footer: "選取的遊戲將轉為 JSON 文字，可分享給朋友匯入。",
        data_import_success: "成功匯入 {count} 個遊戲",
        data_import_error: "無效的 JSON 格式",
        data_error_format: "格式錯誤：{name} 缺少必要欄位",
        data_error_no_data: "沒有可匯出的有效資料",
        data_error_empty: "無資料",
        data_export_fail: "匯出失敗，請重試",
        data_prep_fail: "準備資料失敗",
        data_mail_subject: "【萬用桌遊計分板】分享遊戲模板 ({date})",
        data_mail_body: "開發者你好！這是我製作的計分板\n↓↓↓ 資料已複製，請在下方貼上(Ctrl+V)↓↓↓\n--------------------------------------------------\n\n--------------------------------------------------",
    },
    'en': {
        data_mgr_title: "Data Manager",
        data_import_tab: "Import",
        data_export_tab: "Export",
        data_import_ph: "Paste JSON data here:",
        data_import_btn: "Import to Library",
        data_export_hint: "Select games to export:",
        data_export_empty: "No custom games found",
        data_builtin_mod: "Built-in Mod",
        data_selected_count: "{count} selected",
        data_select_all: "Select All",
        data_deselect_all: "Deselect All",
        data_copy_json: "Copy JSON",
        data_mail_dev: "Send to Dev",
        data_copy_success: "Copied successfully",
        data_export_footer: "Selected games will be converted to JSON text.",
        data_import_success: "Imported {count} games",
        data_import_error: "Invalid JSON format",
        data_error_format: "Format Error: {name} is missing fields",
        data_error_no_data: "No valid data to import",
        data_error_empty: "No data",
        data_export_fail: "Export failed, please retry",
        data_prep_fail: "Failed to prepare data",
        data_mail_subject: "[ScorePad] Share Templates ({date})",
        data_mail_body: "Hi Dev! Here are my custom templates\n↓↓↓ Data Copied Below (Ctrl+V) ↓↓↓\n--------------------------------------------------\n\n--------------------------------------------------",
    }
};

export type DataManagerTranslationKey = keyof typeof dataManagerTranslations['zh-TW'];

export const useDataManagerTranslation = () => {
    const { language } = useTranslation();
    const t = (key: DataManagerTranslationKey, params?: Record<string, string | number>) => {
        const dict = dataManagerTranslations[language] || dataManagerTranslations['zh-TW'];
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

import { useTranslation } from './index';

export const cloudLibraryTranslations = {
    'zh-TW': {
        lib_title: "☁️ 雲端公共庫 (測試)",
        lib_subtitle: "在彈窗中即時瀏覽由社群共享的計分模板，點擊「匯入」即可將其下載並實體化至您的本機庫中。",
        lib_loading: "正在下載雲端計分板...",
        lib_error: "載入雲端資料失敗，請檢查網路或重試。",
        lib_download_count: "{count} 次下載",
        lib_btn_import: "📥 匯入本機",
        lib_btn_imported: "✅ 已匯入",
        lib_btn_import_all: "⚡ 一鍵匯入全部",
        lib_no_data: "雲端資料庫目前沒有範本",
        lib_import_success: "成功匯入「{name}」計分板！",
        lib_import_all_success: "已成功匯入全部 {count} 個雲端計分板！",
        lib_import_already: "此模板已存在於您的本機中",
        lib_delete_confirm: "確定要將「{name}」從雲端 D1 資料庫永久刪除嗎？此操作不可逆！",
        lib_delete_success: "「{name}」已成功從雲端清除！",
        lib_delete_failed: "清除失敗: {error}",
        lib_btn_delete_tooltip: "從雲端永久清除此垃圾資料",
    },
    'en': {
        lib_title: "☁️ Cloud Library (Test)",
        lib_subtitle: "Browse shared templates from the cloud and click 'Import' to download them into your local library instantly.",
        lib_loading: "Downloading cloud templates...",
        lib_error: "Failed to load cloud library. Please check your connection.",
        lib_download_count: "{count} downloads",
        lib_btn_import: "📥 Import",
        lib_btn_imported: "✅ Imported",
        lib_btn_import_all: "⚡ Import All",
        lib_no_data: "No templates found in cloud database",
        lib_import_success: "Successfully imported \"{name}\"!",
        lib_import_all_success: "Successfully imported all {count} templates!",
        lib_import_already: "This template already exists in your library",
        lib_delete_confirm: "Are you sure you want to permanently delete \"{name}\" from the Cloud D1 database? This action is irreversible!",
        lib_delete_success: "Successfully deleted \"{name}\" from the cloud!",
        lib_delete_failed: "Delete failed: {error}",
        lib_btn_delete_tooltip: "Permanently delete this template from the cloud",
    }
};

export type CloudLibraryTranslationKey = keyof typeof cloudLibraryTranslations['zh-TW'];

export const useCloudLibraryTranslation = () => {
    const { language } = useTranslation();
    const t = (key: CloudLibraryTranslationKey, params?: Record<string, string | number>) => {
        const dict = cloudLibraryTranslations[language] || cloudLibraryTranslations['zh-TW'];
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

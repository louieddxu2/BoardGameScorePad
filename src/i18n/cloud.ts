import { useTranslation } from './index';

export const cloudTranslations = {
    'zh-TW': {
        // --- Cloud Manager ---
        cloud_title: "雲端備份",
        cloud_connect_title: "啟用完整功能",
        cloud_connect_desc: "連線 Google Drive 以解鎖雲端同步與自動備份。",
        cloud_benefit_1_title: "自動雲端備份",
        cloud_benefit_1_desc: "確保您的計分紀錄與自訂模板永不遺失。",
        cloud_benefit_2_title: "跨裝置同步",
        cloud_benefit_2_desc: "在手機、平板或電腦間無縫切換進度。",
        cloud_benefit_3_title: "專屬檔案空間",
        cloud_benefit_3_desc: "僅存取本 App 建立的備份檔，保障隱私。",
        cloud_btn_connect: "立即連線",
        cloud_tab_templates: "遊戲庫",
        cloud_tab_active: "進行中",
        cloud_tab_history: "歷史",
        cloud_tab_files: "雲端檔案",
        cloud_tab_trash: "垃圾桶",
        cloud_empty_trash: "清空垃圾桶",
        cloud_empty_list: "雲端沒有找到備份檔案",
        cloud_empty_trash_list: "垃圾桶是空的",
        cloud_download_restore: "下載並還原",
        cloud_restore: "還原",
        cloud_delete_perm: "永久刪除",
        cloud_confirm_delete_title: "永久刪除備份？",
        cloud_confirm_delete_msg: "確定要永久刪除「{name}」嗎？此動作無法復原。",
        cloud_confirm_empty_title: "清空垃圾桶？",
        cloud_confirm_empty_msg: "確定要永久刪除所有垃圾桶中的檔案嗎？此動作無法復原。",
        cloud_confirm_logout_title: "登出 Google Drive？",
        cloud_confirm_logout_msg: "登出後將無法自動備份。您的檔案仍會保留在雲端。",

        // --- Sync Dashboard ---
        sync_title: "資料同步中心",
        sync_backup_title: "備份至雲端",
        sync_backup_desc: "將本機的資料上傳至 Google Drive",
        sync_restore_title: "從雲端還原",
        sync_restore_desc: "將 Google Drive 的資料下載至本機",
        sync_btn_upload: "開始上傳",
        sync_btn_download: "開始下載",
        sync_status_processing: "處理中...",
        sync_status_success: "成功",
        sync_status_skipped: "略過 (最新)",
        sync_status_failed: "失敗",
        sync_error_details: "錯誤詳情",
        sync_msg_limit: "雲端僅保留最新的 20 筆進行中遊戲，舊檔將自動刪除。",
        sync_msg_newer: "若雲端已有較新版本，將自動略過。",
        sync_msg_restore_warn: "此動作將會把雲端資料寫入本機。不包含進行中遊戲（若需取回暫存檔，請至「雲端備份管理」手動下載）。",
    },
    'en': {
        // --- Cloud Manager ---
        cloud_title: "Cloud Backup",
        cloud_connect_title: "Enable Full Features",
        cloud_connect_desc: "Connect to Google Drive to unlock cloud sync and auto-backup.",
        cloud_benefit_1_title: "Auto Cloud Backup",
        cloud_benefit_1_desc: "Never lose your score records and custom templates.",
        cloud_benefit_2_title: "Cross-Device Sync",
        cloud_benefit_2_desc: "Seamlessly switch between phone, tablet, and PC.",
        cloud_benefit_3_title: "Private App Folder",
        cloud_benefit_3_desc: "Only access files created by this App to protect privacy.",
        cloud_btn_connect: "Connect Now",
        cloud_tab_templates: "Library",
        cloud_tab_active: "Active",
        cloud_tab_history: "History",
        cloud_tab_files: "Cloud Files",
        cloud_tab_trash: "Trash",
        cloud_empty_trash: "Empty Trash",
        cloud_empty_list: "No backup files found",
        cloud_empty_trash_list: "Trash is empty",
        cloud_download_restore: "Download & Restore",
        cloud_restore: "Restore",
        cloud_delete_perm: "Delete Permanently",
        cloud_confirm_delete_title: "Delete Permanently?",
        cloud_confirm_delete_msg: "Are you sure you want to delete \"{name}\"? This cannot be undone.",
        cloud_confirm_empty_title: "Empty Trash?",
        cloud_confirm_empty_msg: "Are you sure you want to delete all files in trash? This cannot be undone.",
        cloud_confirm_logout_title: "Disconnect Drive?",
        cloud_confirm_logout_msg: "Auto-backup will stop after disconnecting. Your files will remain in the cloud.",

        // --- Sync Dashboard ---
        sync_title: "Sync Center",
        sync_backup_title: "Backup to Cloud",
        sync_backup_desc: "Upload local data to Google Drive",
        sync_restore_title: "Restore from Cloud",
        sync_restore_desc: "Download data from Google Drive to this device",
        sync_btn_upload: "Start Upload",
        sync_btn_download: "Start Download",
        sync_status_processing: "Processing...",
        sync_status_success: "Success",
        sync_status_skipped: "Skipped (Up to date)",
        sync_status_failed: "Failed",
        sync_error_details: "Error Details",
        sync_msg_limit: "Cloud keeps the latest 20 active sessions. Older ones are auto-deleted.",
        sync_msg_newer: "Skipped if cloud version is newer.",
        sync_msg_restore_warn: "This will overwrite local data with cloud data. Active sessions are NOT included (download them manually from Cloud Backup Manager if needed).",
    }
};

export type CloudTranslationKey = keyof typeof cloudTranslations['zh-TW'];

export const useCloudTranslation = () => {
    const { language } = useTranslation();
    const t = (key: CloudTranslationKey, params?: Record<string, string | number>) => {
        const dict = cloudTranslations[language] || cloudTranslations['zh-TW'];
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

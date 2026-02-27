import { useTranslation } from './index';

export const cloudTranslations = {
    'zh-TW': {
        // --- Onboarding / Greeting ---
        greeting: "你好～",
        p1: "感謝你使用此 App，雲端功能其實是不必要的，但如果你有「多裝置使用」、「轉移裝置」的需求，或單純覺得「備份比較安心」的話，可以啟用這個功能，有「一鍵上傳/下載」的功能，可以將本機端的所有儲存資料都上傳到你自己的 Google Drive 裡面。",
        p2: "此 App 徵詢的權限只有在你的 Google Drive 裡讀取/更改「由此 App 所建立的檔案」，實際上會創建一個名為 BoardGameScorePad 資料夾來存放所有東西，拍攝的照片也可以在對應的歷史紀錄裡找到。",
        signature: "東東(黃紹東)",

        // --- Cloud Manager Generic ---
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
        cloud_restore: "還原",
        cloud_delete_perm: "永久刪除",
        cloud_mock_badge: "模擬",
        cloud_open_sync: "同步與備份",
        cloud_disconnect: "登出 Google Drive",

        cloud_confirm_delete_title: "永久刪除備份？",
        cloud_confirm_delete_msg: "確定要永久刪除「{name}」嗎？此動作無法復原。",
        cloud_confirm_empty_title: "清空垃圾桶？",
        cloud_confirm_empty_msg: "確定要永久刪除所有垃圾桶中的檔案嗎？此動作無法復原。",
        cloud_confirm_logout_title: "登出 Google Drive？",
        cloud_confirm_logout_msg: "登出後將無法自動備份。您的檔案仍會保留在雲端。",

        // --- Toasts & Alerts ---
        cloud_toast_connect_success: "Google Drive 連線成功",
        cloud_toast_cancel_login: "已取消登入",
        cloud_toast_connect_failed: "連線失敗，請檢查網路或稍後再試",
        cloud_toast_disconnect_success: "已斷開 Google Drive 連線",
        cloud_toast_api_disabled: "設定錯誤：API 未啟用",
        cloud_toast_auth_failed: "權限不足或憑證過期，請重新連結。",
        cloud_toast_action_failed: "{action}失敗: {errMsg}",
        cloud_toast_backing_up: "正在上傳備份...",
        cloud_toast_backup_success: "備份成功！",
        cloud_toast_restoring: "正在還原...",
        cloud_toast_restore_success: "還原成功！",
        cloud_toast_downloading: "正在下載...",
        cloud_toast_downloading_history: "正在下載歷史紀錄...",
        cloud_toast_download_success: "下載成功！",
        cloud_toast_restore_folder_success: "已還原至對應資料夾",
        cloud_toast_downloading_image: "正在下載圖片...",
        cloud_toast_image_success: "圖片載入完成",
        cloud_toast_deleting: "正在永久刪除...",
        cloud_toast_delete_success: "刪除成功",
        cloud_toast_emptying_trash_category: "正在清空此分類垃圾桶...",
        cloud_toast_emptying_trash_all: "正在清空所有垃圾桶...",
        cloud_toast_trash_empty_success: "垃圾桶已清空",
        cloud_toast_restore_image_note: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。",
        cloud_toast_find_linked_template: "本機找不到對應計分板，正在搜尋雲端備份...",
        cloud_toast_restore_all_success: "已自動還原關聯的計分板與紀錄",

        cloud_alert_session_in_history: "此進行中遊戲已結束並存放於歷史紀錄中，要下載請先手動刪除該歷史紀錄（時間：{date}）",
        cloud_alert_template_missing: "對應計分板已遺失，無法還原此紀錄",
        cloud_tooltip_trash: "移至垃圾桶",
        cloud_image_note: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。",

        cloud_err_not_enabled: "雲端功能未開啟",
        cloud_unknown_game: "未命名遊戲",
        cloud_active_session_prefix: "進行中: {id}",
        cloud_system_settings: "系統設定",

        // --- Actions ---
        cloud_action_backup: "備份",
        cloud_action_fetch: "讀取列表",
        cloud_action_restore: "還原",
        cloud_action_download: "下載",
        cloud_action_download_history: "下載歷史",
        cloud_action_download_image: "圖片下載",
        cloud_action_delete: "刪除",
        cloud_action_empty: "清空",
        cloud_action_full_backup_init: "全域備份初始化",
        cloud_action_full_restore_init: "全域還原初始化",

        // --- Sync Dashboard ---
        sync_title: "資料同步中心",
        sync_backup_title: "備份至雲端",
        sync_backup_desc: "將本機的資料上傳至 Google Drive",
        sync_restore_title: "從雲端還原",
        sync_restore_desc: "將 Google Drive 的資料下載至本機",
        sync_btn_upload: "開始上傳",
        sync_btn_download: "開始下載",
        sync_btn_close: "關閉並重整列表",
        sync_status_processing: "處理中...",
        sync_status_success: "成功",
        sync_status_skipped: "略過 (最新)",
        sync_status_failed: "失敗",
        sync_error_details: "錯誤詳情",
        sync_msg_limit: "雲端僅保留最新的 20 筆進行中遊戲，舊檔將自動刪除。",
        sync_msg_newer: "若雲端已有較新版本，將自動略過。",
        sync_msg_restore_warn: "此動作將會把雲端資料寫入本機。不包含進行中遊戲（若需取回暫存檔，請至「雲端備份管理」手動下載）。",
        sync_backup_processing: "正在備份至雲端...",
        sync_restore_processing: "正在從雲端還原...",
        sync_preparing: "準備中...",
        sync_backup_done: "備份完成",
        sync_restore_done: "還原完成",
        sync_scanning: "分析資料中...",
        sync_stat_games: "遊戲",
        sync_stat_active: "進行中",
        sync_stat_history: "歷史",
        sync_restore_notice: "注意事項",
    },
    'en': {
        // --- Onboarding / Greeting ---
        greeting: "Hello~",
        p1: "Thanks for using this App! Cloud features aren't strictly necessary, but if you use multiple devices, plan to switch phones, or just want peace of mind, you can enable this. It offers one-click upload/download to your own Google Drive.",
        p2: "The permission requested is limited to reading/editing files *created by this App* within your Google Drive. It creates a folder named 'BoardGameScorePad' to store everything. Photos can also be found within their history records.",
        signature: "Dong-Dong",

        // --- Cloud Manager Generic ---
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
        cloud_restore: "Restore",
        cloud_delete_perm: "Delete Permanently",
        cloud_mock_badge: "Mock",
        cloud_open_sync: "Sync & Backup",
        cloud_disconnect: "Disconnect Google Drive",

        cloud_confirm_delete_title: "Delete Permanently?",
        cloud_confirm_delete_msg: "Are you sure you want to delete \"{name}\"? This cannot be undone.",
        cloud_confirm_empty_title: "Empty Trash?",
        cloud_confirm_empty_msg: "Are you sure you want to delete all files in trash? This cannot be undone.",
        cloud_confirm_logout_title: "Disconnect Drive?",
        cloud_confirm_logout_msg: "Auto-backup will stop after disconnecting. Your files will remain in the cloud.",

        // --- Toasts & Alerts ---
        cloud_toast_connect_success: "Google Drive connected successfully",
        cloud_toast_cancel_login: "Login cancelled",
        cloud_toast_connect_failed: "Connection failed. Please check network and try again.",
        cloud_toast_disconnect_success: "Disconnected from Google Drive",
        cloud_toast_api_disabled: "Config error: API not enabled",
        cloud_toast_auth_failed: "Insufficient permissions or expired credentials. Please reconnect.",
        cloud_toast_action_failed: "{action} failed: {errMsg}",
        cloud_toast_backing_up: "Backing up...",
        cloud_toast_backup_success: "Backup successful!",
        cloud_toast_restoring: "Restoring...",
        cloud_toast_restore_success: "Restore successful!",
        cloud_toast_downloading: "Downloading...",
        cloud_toast_downloading_history: "Downloading history records...",
        cloud_toast_download_success: "Download successful!",
        cloud_toast_restore_folder_success: "Restored to the original folder",
        cloud_toast_downloading_image: "Downloading image...",
        cloud_toast_image_success: "Image loaded successfully",
        cloud_toast_deleting: "Deleting permanently...",
        cloud_toast_delete_success: "Deleted successfully",
        cloud_toast_emptying_trash_category: "Emptying this category in trash...",
        cloud_toast_emptying_trash_all: "Emptying all trash...",
        cloud_toast_trash_empty_success: "Trash emptied",
        cloud_toast_restore_image_note: "Template restored. Note: Background images need to be set or loaded when opening the game.",
        cloud_toast_find_linked_template: "Template not found locally. Searching cloud backup...",
        cloud_toast_restore_all_success: "Linked templates and records restored automatically",

        cloud_alert_session_in_history: "This active game has ended and is in history records. Delete the history record first to download (Time: {date})",
        cloud_alert_template_missing: "Corresponding board game missing. Cannot restore this record.",
        cloud_tooltip_trash: "Move to trash",
        cloud_image_note: "Template restored. Note: Background images need to be set or loaded when opening the game.",

        cloud_err_not_enabled: "Cloud features not enabled",
        cloud_unknown_game: "Unknown Game",
        cloud_active_session_prefix: "In Progress: {id}",
        cloud_system_settings: "System Settings",

        // --- Actions ---
        cloud_action_backup: "Backup",
        cloud_action_fetch: "Fetch List",
        cloud_action_restore: "Restore",
        cloud_action_download: "Download",
        cloud_action_download_history: "Download History",
        cloud_action_download_image: "Download Image",
        cloud_action_delete: "Delete",
        cloud_action_empty: "Empty",
        cloud_action_full_backup_init: "Full Backup Init",
        cloud_action_full_restore_init: "Full Restore Init",

        // --- Sync Dashboard ---
        sync_title: "Sync Center",
        sync_backup_title: "Backup to Cloud",
        sync_backup_desc: "Upload local data to Google Drive",
        sync_restore_title: "Restore from Cloud",
        sync_restore_desc: "Download data from Google Drive to this device",
        sync_btn_upload: "Start Upload",
        sync_btn_download: "Start Download",
        sync_btn_close: "Close & Refresh",
        sync_status_processing: "Processing...",
        sync_status_success: "Success",
        sync_status_skipped: "Skipped (Up to date)",
        sync_status_failed: "Failed",
        sync_error_details: "Error Details",
        sync_msg_limit: "Cloud keeps the latest 20 active sessions. Older ones are auto-deleted.",
        sync_msg_newer: "Older versions will be skipped.",
        sync_msg_restore_warn: "This will overwrite local data with cloud data. Active sessions NOT included (download manually from Cloud Manager).",
        sync_backup_processing: "Backing up to cloud...",
        sync_restore_processing: "Restoring from cloud...",
        sync_preparing: "Preparing...",
        sync_backup_done: "Backup Complete",
        sync_restore_done: "Restore Complete",
        sync_scanning: "Scanning data...",
        sync_stat_games: "Games",
        sync_stat_active: "Active",
        sync_stat_history: "History",
        sync_restore_notice: "Notice",
    }
};

export type CloudTranslationKey = keyof typeof cloudTranslations['zh-TW'];

export const useCloudTranslation = () => {
    const { language } = useTranslation();
    const t = (key: CloudTranslationKey, params?: Record<string, string | number>) => {
        const dict = (cloudTranslations as any)[language] || cloudTranslations['zh-TW'];
        let text = (dict as any)[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };
    return { t, language };
};


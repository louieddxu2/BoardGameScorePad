import { useTranslation } from './index';

export const appTranslations = {
  'zh-TW': {
    msg_press_again_to_exit: "再按一次即可離開",

    // --- Install Guide ---
    install_title: "安裝到主畫面",
    install_desc: "將此網頁安裝為 App，可獲得最佳的全螢幕體驗與離線功能。請依照您的裝置類型操作：",
    install_ios: "iOS (iPhone/iPad)",
    install_ios_step1: "點擊瀏覽器底部的",
    install_ios_step1_suffix: "按鈕。",
    install_ios_step2: "在選單中往下滑，找到並點擊",
    install_ios_add: "加入主畫面",
    install_ios_step3: "點擊右上角的「加入」即可完成。",
    install_android: "Android (Chrome)",
    install_android_step1: "點擊瀏覽器右上角的",
    install_android_step1_suffix: "圖示。",
    install_android_step2: "選擇",
    install_android_step2_or: "或",
    install_android_menu: "選單",
    install_android_add: "加到主畫面",
    install_android_install: "安裝應用程式",

    // --- Sessions & History ---
    msg_confirm_exit_session: "您確定要離開嗎？目前的計分進度將會遺失。",
    msg_import_success: "成功匯入 {count} 筆紀錄",
    msg_import_failed: "匯入失敗，請檢查檔案格式",

    // --- BGStats Service Progress ---
    msg_syncing_location: "正在同步地點...",
    msg_syncing_players: "正在同步玩家...",
    msg_syncing_games: "正在同步遊戲資料...",
    msg_importing_plays: "正在匯入 {count} 筆遊玩紀錄...",
    msg_preparing_data: "準備資料中...",
    msg_writing_records: "寫入紀錄 ({current} / {total})...",
    msg_updating_links: "正在更新計分板連結...",

    // --- Misc ---
    rotate_device: "請旋轉您的裝置",
    rotate_device_desc: "此應用程式在手機上僅支援直式操作，以獲得最佳體驗。",
    error_boundary_title: "發生了一些問題",
    error_boundary_desc: "應用程式遇到預期外的錯誤。這通常是因為瀏覽器翻譯插件破壞了網頁結構，請嘗試關閉翻譯後重新載入。",
    error_boundary_btn: "重新載入應用程式",

    // --- useAppData Toasts ---
    app_toast_sync_trash: "已同步移至雲端垃圾桶",
    app_toast_delete_failed: "刪除失敗，請重試",
    app_toast_disposable_removed: "簡易計分板已移除",
    app_toast_restore_builtin: "已還原預設值 (修改已另存為備份)",
    app_toast_restore_failed: "還原失敗",
    app_toast_history_deleted: "紀錄已刪除",
    app_toast_import_session: "遊戲進度已匯入",
    app_toast_import_failed: "匯入失敗",
    app_toast_launch_error: "遊戲啟動失敗",
    app_toast_history_restored: "歷史紀錄已還原",
    app_toast_link_template_missing: "找不到對應的內建計分板",
    app_toast_link_open_failed: "無法開啟分享連結",
  },
  'en': {
    msg_press_again_to_exit: "Press back again to exit",

    // --- Sessions & History ---
    msg_confirm_exit_session: "Are you sure you want to leave? Current progress will be lost.",
    msg_import_success: "Successfully imported {count} records",
    msg_import_failed: "Import failed, please check file format",

    // --- BGStats Service Progress ---
    msg_syncing_location: "Syncing locations...",
    msg_syncing_players: "Syncing players...",
    msg_syncing_games: "Syncing games...",
    msg_importing_plays: "Importing {count} plays...",
    msg_preparing_data: "Preparing data...",
    msg_writing_records: "Writing records ({current} / {total})...",
    msg_updating_links: "Updating board game links...",

    // --- Install Guide ---
    install_title: "Install App",
    install_desc: "Install to home screen for fullscreen experience and offline support.",
    install_ios: "iOS (iPhone/iPad)",
    install_ios_step1: "Tap the bottom",
    install_ios_step1_suffix: "button.",
    install_ios_step2: "Scroll down and tap",
    install_ios_add: "Add to Home Screen",
    install_ios_step3: "Tap 'Add' at the top right.",
    install_android: "Android (Chrome)",
    install_android_step1: "Tap the top right",
    install_android_step1_suffix: "icon.",
    install_android_step2: "Select",
    install_android_step2_or: "or",
    install_android_menu: "Menu",
    install_android_add: "Add to Home Screen",
    install_android_install: "Install App",

    // --- Misc ---
    rotate_device: "Please Rotate Device",
    rotate_device_desc: "This app is optimized for portrait mode on mobile.",
    error_boundary_title: "Something went wrong",
    error_boundary_desc: "An unexpected error occurred. This is often caused by browser translation plugins. Please disable translation and reload.",
    error_boundary_btn: "Reload App",

    // --- useAppData Toasts ---
    app_toast_sync_trash: "Synced to cloud trash",
    app_toast_delete_failed: "Delete failed, please try again",
    app_toast_disposable_removed: "Simple board removed",
    app_toast_restore_builtin: "Default restored (Modifications backed up)",
    app_toast_restore_failed: "Restore failed",
    app_toast_history_deleted: "Record deleted",
    app_toast_import_session: "Progress imported",
    app_toast_import_failed: "Import failed",
    app_toast_launch_error: "Failed to launch game",
    app_toast_history_restored: "History record restored",
    app_toast_link_template_missing: "Built-in scoreboard not found",
    app_toast_link_open_failed: "Failed to open share link",
  }
};

export type AppTranslationKey = keyof typeof appTranslations['zh-TW'];

export const useAppTranslation = () => {
  const { language } = useTranslation();
  const t = (key: AppTranslationKey, params?: Record<string, string | number>) => {
    const dict = appTranslations[language] || appTranslations['zh-TW'];
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

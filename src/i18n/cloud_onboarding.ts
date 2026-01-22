
export const cloudOnboardingTranslations = {
  'zh-TW': {
    // Letter / Onboarding
    greeting: "你好～",
    p1: "感謝你使用此 App，雲端功能其實是不必要的，但如果你有「多裝置使用」、「轉移裝置」的需求，或單純覺得「備份比較安心」的話，可以啟用這個功能，有「一鍵上傳/下載」的功能，可以將本機端的所有儲存資料都上傳到你自己的 Google Drive 裡面。",
    p2: "此 App 徵詢的權限只有在你的 Google Drive 裡新增/刪除「由此 App 所建立的檔案」，實際上會創建一個名為 BoardGameScorePad 資料夾來存放所有東西，拍攝的照片也可以在對應的歷史紀錄裡找到。",
    signature: "黃紹東",

    // UI Elements
    title: "雲端備份",
    disconnect: "登出 Google Drive",
    sync_title: "資料同步中心",
    open_sync: "同步與備份",
    
    // Tabs
    tab_templates: "遊戲庫",
    tab_active: "進行中",
    tab_history: "歷史",
    tab_files: "雲端檔案",
    tab_trash: "垃圾桶",

    // Buttons
    btn_connect: "立即連線",
    btn_download_restore: "下載並還原",
    btn_restore: "還原",
    btn_delete_perm: "永久刪除",
    btn_empty_trash: "清空垃圾桶",

    // Empty States
    empty_list: "雲端沒有找到備份檔案",
    empty_trash_list: "垃圾桶是空的",

    // Confirmations
    confirm_delete_title: "永久刪除備份？",
    confirm_delete_msg: "確定要永久刪除「{name}」嗎？此動作無法復原。",
    confirm_empty_title: "清空垃圾桶？",
    confirm_empty_msg: "確定要永久刪除所有垃圾桶中的檔案嗎？此動作無法復原。",
    confirm_logout_title: "登出 Google Drive？",
    confirm_logout_msg: "登出後將無法自動備份。您的檔案仍會保留在雲端。",
  },
  'en': {
    // Letter / Onboarding
    greeting: "Hello~",
    p1: "Thank you for using this App! The cloud feature isn't strictly necessary, but if you use multiple devices, plan to switch to a new phone, or just want the peace of mind of having a backup, you can enable this. It offers a one-click upload/download to save all your local data to your own Google Drive.",
    p2: "The permission requested is limited to creating and deleting files *created by this App* within your Google Drive. It will create a folder named 'BoardGameScorePad' to store everything. Any photos taken can also be found within their corresponding history records.",
    signature: "Dong-Dong",

    // UI Elements
    title: "Cloud Backup",
    disconnect: "Disconnect",
    sync_title: "Sync Center",
    open_sync: "Sync & Backup",

    // Tabs
    tab_templates: "Library",
    tab_active: "Active",
    tab_history: "History",
    tab_files: "Cloud Files",
    tab_trash: "Trash",

    // Buttons
    btn_connect: "Connect Now",
    btn_download_restore: "Download & Restore",
    btn_restore: "Restore",
    btn_delete_perm: "Delete Permanently",
    btn_empty_trash: "Empty Trash",

    // Empty States
    empty_list: "No backup files found",
    empty_trash_list: "Trash is empty",

    // Confirmations
    confirm_delete_title: "Delete Permanently?",
    confirm_delete_msg: "Are you sure you want to delete \"{name}\"? This cannot be undone.",
    confirm_empty_title: "Empty Trash?",
    confirm_empty_msg: "Are you sure you want to delete all files in trash? This cannot be undone.",
    confirm_logout_title: "Disconnect Drive?",
    confirm_logout_msg: "Auto-backup will stop after disconnecting. Your files will remain in the cloud.",
  }
};

export type CloudOnboardingKey = keyof typeof cloudOnboardingTranslations['zh-TW'];

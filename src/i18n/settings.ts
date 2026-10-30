import { useTranslation } from './index';

const translations = {
  'zh-TW': {
    settings: '設定', appearance: '介面色系',
    export_all: '匯出全部資料', import_all: '匯入全部資料',
    export_description: '下載 ZIP 備份，包含自訂計分板、遊戲紀錄、進行中遊戲、照片與設定。',
    import_description: '從 ZIP 備份還原，覆蓋此裝置既有的所有資料。',
    builtin_notice: '內建計分板不會匯入或匯出。',
    confirm_title: '覆蓋全部資料？',
    confirm_message: '匯入將覆蓋此裝置目前所有自訂計分板、遊戲紀錄、進行中遊戲、照片與設定，無法復原。缺漏或毀損項目會跳過並在完成時說明，既有資料仍會被覆蓋。請先匯出備份，並關閉其他開啟此網站的分頁。內建計分板不受影響。完成後會重新載入頁面。',
    confirm_import: '覆蓋並匯入', cancel: '取消',
    exporting: '正在匯出', importing: '正在驗證與匯入', export_success: '備份已準備下載',
    import_success: '全部資料已匯入；若畫面未更新，請重新載入頁面。',
    import_partial: '可用資料已匯入。缺漏或毀損項目已記錄在下方清單。',
    import_partial_done: '可用資料已匯入',
    import_partial_reload: '可用資料已匯入，缺漏或毀損項目已跳過。按下確認以重新載入頁面，本次結果不會保留。',
    import_issues: '本次匯入的缺漏與毀損項目', issue_missing: '缺漏', issue_checksum: '檔案校驗不符', issue_invalid: '內容毀損或格式不符',
    import_done: '匯入完成', import_reload_message: '全部資料已匯入。按下確認以重新載入頁面並套用設定。', confirm: '確認',
    error_invalid: '備份格式不符、檔案損壞或缺少資料，尚未覆蓋原有資料。',
    error_location: '檢查位置：',
    export_success_with_missing_refs: '本機可讀資料已匯出。缺漏、毀損項目與影像參照已記錄在 ZIP 內的清單。',
    error_busy: '請先離開或關閉多人同步房間，再匯入備份。',
    error_storage: '無法完成備份。請確認裝置儲存空間與瀏覽器儲存權限後重試。',
    error_unsupported: '此備份版本或瀏覽器目前不支援，請更新後重試。',
    error_unknown: '操作失敗，請確認檔案與裝置儲存空間後重試。',
  },
  en: {
    settings: 'Settings', appearance: 'Appearance',
    export_all: 'Export all data', import_all: 'Import all data',
    export_description: 'Download a ZIP backup of custom scoreboards, game records, active games, photos and settings.',
    import_description: 'Restore a ZIP backup, replacing all existing data on this device.',
    builtin_notice: 'Built-in scoreboards are excluded from export and import.',
    confirm_title: 'Replace all data?',
    confirm_message: 'Importing replaces all custom scoreboards, game records, active games, photos and settings on this device. This cannot be undone. Missing or damaged items are skipped and listed when import finishes; existing device data is still replaced. Export a backup first and close other tabs of this site. Built-in scoreboards are preserved. The page will reload when finished.',
    confirm_import: 'Replace and import', cancel: 'Cancel',
    exporting: 'Exporting', importing: 'Validating and importing', export_success: 'Backup ready to download',
    import_success: 'All data imported. Reload the page if the display has not updated.',
    import_partial: 'Usable data imported. Missing or damaged items are listed below.',
    import_partial_done: 'Usable data imported',
    import_partial_reload: 'Usable data imported. Missing or damaged items were skipped. Press Confirm to reload; these results will not be kept.',
    import_issues: 'This import: missing or damaged items', issue_missing: 'Missing', issue_checksum: 'Checksum mismatch', issue_invalid: 'Invalid content or format',
    import_done: 'Import complete', import_reload_message: 'All data imported. Press Confirm to reload the page and apply settings.', confirm: 'Confirm',
    error_invalid: 'This backup is invalid, damaged or incomplete. Existing data has not been replaced.',
    error_location: 'Check location: ',
    export_success_with_missing_refs: 'Readable local data exported. Missing or damaged items and image references were recorded in the ZIP report.',
    error_busy: 'Leave or close your multiplayer room before importing a backup.',
    error_storage: 'Backup could not complete. Check device storage and browser storage permissions, then try again.',
    error_unsupported: 'This backup version or browser is not supported. Update and try again.',
    error_unknown: 'The operation failed. Check the file and available device storage, then try again.',
  },
};

export function useSettingsTranslation() {
  const { language } = useTranslation();
  return (key: keyof typeof translations['en']) => translations[language][key];
}


import { useTranslation } from '../i18n';

export const bgStatsTranslations = {
  'zh-TW': {
    title: "BG Stats 整合",
    desc_text: "此功能可讓您在 Board Game Stats (BG Stats) 與本 App 之間轉移資料。",
    
    btn_import: "匯入 BG Stats 紀錄",
    btn_import_sub: "讀取 .json 備份檔",
    
    btn_export_idle: "匯出為 BG Stats 格式",
    btn_export_processing: "正在準備檔案...",
    btn_export_ready: "下載 / 分享檔案",
    btn_export_sub: "（功能測試中，建議先嘗試少數資料確認結果是否正確。成功或失敗也歡迎跟我說）",
    
    footer: "支援標準 BG Stats JSON 格式",
    
    state_importing: "正在匯入資料...",
    state_analyzing: "正在分析檔案...",
    warn_keep_open: "請勿關閉視窗",
    
    msg_import_error: "匯入過程發生錯誤",
    msg_export_prep_fail: "匯出準備失敗",
    msg_share_success: "分享成功",
    msg_download_start: "下載已開始",
    
    msg_invalid_format: "格式錯誤：這似乎不是 BG Stats 的備份檔",
    msg_read_failed: "讀取失敗：檔案格式無效",
    msg_read_error: "讀取檔案時發生錯誤",
  },
  'en': {
    title: "BG Stats Integration",
    desc_text: "Transfer data between Board Game Stats (BG Stats) and this App.",
    
    btn_import: "Import BG Stats Data",
    btn_import_sub: "Load .json backup file",
    
    btn_export_idle: "Export to BG Stats Format",
    btn_export_processing: "Preparing file...",
    btn_export_ready: "Download / Share File",
    btn_export_sub: "(Beta testing. Please test with small data first. Feedback is welcome!)",
    
    footer: "Supports standard BG Stats JSON format",
    
    state_importing: "Importing data...",
    state_analyzing: "Analyzing file...",
    warn_keep_open: "Do not close window",
    
    msg_import_error: "Error during import",
    msg_export_prep_fail: "Export preparation failed",
    msg_share_success: "Share successful",
    msg_download_start: "Download started",
    
    msg_invalid_format: "Invalid format: This does not appear to be a BG Stats backup file",
    msg_read_failed: "Read failed: Invalid file format",
    msg_read_error: "Error occurred while reading file",
  }
};

export type BgStatsTranslationKey = keyof typeof bgStatsTranslations['zh-TW'];

export const useBgStatsTranslation = () => {
  const { language } = useTranslation();
  const t = (key: BgStatsTranslationKey) => {
    const dict = bgStatsTranslations[language] || bgStatsTranslations['zh-TW'];
    return dict[key] || key;
  };
  return { t };
};

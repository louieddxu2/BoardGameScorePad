import { useTranslation } from './index';

export const integrationTranslations = {
    'zh-TW': {
        // BGG
        bgg_import_title: "BGG 字典匯入",
        bgg_search_placeholder: "搜尋桌遊名稱...",
        bgg_msg_import_success: "成功更新 {count} 個現有遊戲，並擴充 BGG 字典",
        bgg_import_fail: "匯入失敗，請檢查網路連線",
        bgg_msg_cooldown: "請稍後再試，資料庫更新冷卻中。",
        bgg_msg_invalid_url: "請輸入有效的網址",
        bgg_msg_download_fail: "下載失敗",
        bgg_msg_connect_fail: "連線失敗：{msg}",
        bgg_msg_import_fail_csv: "BGG 匯出失敗，請確認 CSV 格式",
        bgg_msg_import_error: "匯入過程發生錯誤",
        bgg_state_analyzing: "正在下載與分析...",
        bgg_state_importing: "正在更新資料庫...",
        bgg_state_hint: "資料量較大時可能需要一點時間",
        bgg_desc_title: "匯入 BoardGameGeek Collection CSV 以建立搜尋字典。",
        bgg_desc_details: "這將豐富搜尋建議與遊戲資料（如人數、重度）。系統會自動嘗試將 BGG 資料連結到您的「我的遊戲庫」。",
        bgg_cloud_import: "從雲端匯入",
        bgg_url_placeholder: "輸入 CSV 或 Google Sheet 網址",
        bgg_btn_update: "更新",
        bgg_cooldown_hint: "資料庫冷卻中，請於 {time} 後再試",
        bgg_cloud_hint: "支援 Google Sheet 分享連結 (5分鐘/次)",
        bgg_btn_select_file: "選擇 CSV 檔案",
        bgg_file_hint: "手動上傳您的 BGG 匯出檔",
        bgg_footer: "支援從 BGG 網站匯出的標準 CSV 格式 (支援 Big5/UTF-8)",

        // BGStats
        bgstats_sync: "同步 BGStats",
        bgstats_import_title: "從 BGStats 匯入",
        bgstats_export_title: "匯出至 BGStats",
        bgstats_title: "BG Stats 整合",
        bgstats_desc: "此功能可讓您在 Board Game Stats (BG Stats) 與本 App 之間轉移資料。",
        bgstats_btn_import: "匯入 BG Stats 紀錄",
        bgstats_btn_import_sub: "讀取 .json 備份檔",
        bgstats_btn_export_idle: "匯出為 BG Stats 格式",
        bgstats_btn_export_processing: "正在準備檔案...",
        bgstats_btn_export_ready: "下載 / 分享檔案",
        bgstats_btn_export_sub: "（功能測試中，建議先嘗試少數資料。成功或失敗也歡迎跟我說）",
        bgstats_footer: "支援標準 BG Stats JSON 格式",
        bgstats_state_importing: "正在匯入資料...",
        bgstats_state_analyzing: "正在分析檔案...",
        bgstats_warn_keep_open: "請勿關閉視窗",
        bgstats_msg_import_error: "匯入過程發生錯誤",
        bgstats_msg_export_prep_fail: "匯出準備失敗",
        bgstats_msg_share_success: "分享成功",
        bgstats_msg_download_start: "下載已開始",
        bgstats_msg_invalid_format: "格式錯誤：這似乎不是 BG Stats 的備份檔",
        bgstats_msg_read_failed: "讀取失敗：檔案格式無效",
        bgstats_msg_read_error: "讀取檔案時發生錯誤",

        // Import Staging
        staging_analysis_done: "分析完成",
        staging_summary: "已自動配對 {games} 款遊戲、{players} 位玩家、{locations} 個地點",
        staging_hint: "請在下方手動連結對應的項目 (先選左邊，再點右邊)。連結後會自動跳至下一項。",
        staging_pending: "{count} 待處理",
        staging_local_db: "本機資料庫 ({count})",
        staging_search_placeholder: "搜尋匯入資料...",
        staging_import_data: "匯入資料 ({count})",
        staging_no_results: "找不到相關項目",
        staging_empty_hint: "請從左側選擇項目進行配對",
        staging_btn_confirm: "確認並匯入",

        // Game Selector
        selector_quick_start: "快速開始",
        selector_search_hint: "搜尋遊戲名稱或 BGG ID",
        selector_no_results: "找不到相符的遊戲",
        selector_from_bgg: "從 BGG 搜尋更多...",
        selector_rule_label: "規則",
        selector_unit_player: "人",
        selector_unit_minute: "分",
        selector_meta_complexity: "重度",
        selector_create_and_score: "建立並計分 \"{name}\"",
        selector_meta_not_set: "未設定",
        selector_unpin_hint: "取消釘選",
        selector_pin_hint: "建立並釘選此簡易計分板",
        selector_label_simple: "簡易",
        selector_placeholder_choice: "請選擇...",
        selector_placeholder_location: "在哪玩?",
        selector_history_location_hint: "選擇歷史地點",
        selector_new_location: "新地點",
        selector_placeholder_location_select: "選擇地點...",
        selector_search_more: "搜尋更多",

        // Common Integration
        external_link: "外部連結",
        loading_data: "正在載入資料...",
        btn_bgstats_open: "BG Stats 整合",
        btn_bgg_open: "BGG 字典匯入",
        history_truncation_label: "顯示 {displayed} 筆，共 {total} 筆",
    },
    'en': {
        // BGG
        bgg_import_title: "BGG Dictionary Import",
        bgg_search_placeholder: "Search board games...",
        bgg_msg_import_success: "Successfully updated {count} games and BGG dictionary",
        bgg_import_fail: "Import failed, check connection",
        bgg_msg_cooldown: "Please try again later, database cooldown in progress.",
        bgg_msg_invalid_url: "Please enter a valid URL",
        bgg_msg_download_fail: "Download failed",
        bgg_msg_connect_fail: "Connection failed: {msg}",
        bgg_msg_import_fail_csv: "BGG export failed, please check CSV format",
        bgg_msg_import_error: "Error during import",
        bgg_state_analyzing: "Downloading and analyzing...",
        bgg_state_importing: "Updating database...",
        bgg_state_hint: "This may take a while for large data",
        bgg_desc_title: "Import BoardGameGeek Collection CSV to build search dictionary.",
        bgg_desc_details: "This will enrich search suggestions and game data (players, complexity). The system will auto-link BGG data to your library.",
        bgg_cloud_import: "Cloud Import",
        bgg_url_placeholder: "Enter CSV or Google Sheet URL",
        bgg_btn_update: "Update",
        bgg_cooldown_hint: "Database cooling down, try again in {time}",
        bgg_cloud_hint: "Supports Google Sheet links (once every 5 mins)",
        bgg_btn_select_file: "Select CSV File",
        bgg_file_hint: "Manually upload your BGG export file",
        bgg_footer: "Supports standard CSV exported from BGG (Big5/UTF-8)",

        // BGStats
        bgstats_sync: "Sync BGStats",
        bgstats_import_title: "Import from BGStats",
        bgstats_export_title: "Export to BGStats",
        bgstats_title: "BG Stats Integration",
        bgstats_desc: "Transfer data between Board Game Stats (BG Stats) and this App.",
        bgstats_btn_import: "Import BG Stats Data",
        bgstats_btn_import_sub: "Load .json backup file",
        bgstats_btn_export_idle: "Export to BG Stats Format",
        bgstats_btn_export_processing: "Preparing file...",
        bgstats_btn_export_ready: "Download / Share File",
        bgstats_btn_export_sub: "(Beta testing. Small data first. Feedback welcome!)",
        bgstats_footer: "Supports standard BG Stats JSON format",
        bgstats_state_importing: "Importing data...",
        bgstats_state_analyzing: "Analyzing file...",
        bgstats_warn_keep_open: "Do not close window",
        bgstats_msg_import_error: "Error during import",
        bgstats_msg_export_prep_fail: "Export preparation failed",
        bgstats_msg_share_success: "Share successful",
        bgstats_msg_download_start: "Download started",
        bgstats_msg_invalid_format: "Invalid format: Not a BG Stats backup",
        bgstats_msg_read_failed: "Read failed: Invalid format",
        bgstats_msg_read_error: "Error while reading file",

        // Import Staging
        staging_analysis_done: "Analysis Complete",
        staging_summary: "Matched {games} games, {players} players, {locations} locations",
        staging_hint: "Manually link items below (select left, then right). Autojumps on link.",
        staging_pending: "{count} Pending",
        staging_local_db: "Local DB ({count})",
        staging_search_placeholder: "Search imported data...",
        staging_import_data: "Imported Data ({count})",
        staging_no_results: "No results found",
        staging_empty_hint: "Select an item from the left to match",
        staging_btn_confirm: "Confirm & Import",

        // Game Selector
        selector_quick_start: "Quick Start",
        selector_search_hint: "Search game name or BGG ID",
        selector_no_results: "No results found",
        selector_from_bgg: "Search BGG for more...",
        selector_rule_label: "Rule",
        selector_unit_player: "P",
        selector_unit_minute: "m",
        selector_meta_complexity: "Weight",
        selector_create_and_score: "Create & Score \"{name}\"",
        selector_meta_not_set: "Not Set",
        selector_unpin_hint: "Unpin",
        selector_pin_hint: "Pin this Simple Sheet",
        selector_label_simple: "Simple",
        selector_placeholder_choice: "Please select...",
        selector_placeholder_location: "Where?",
        selector_history_location_hint: "History Locations",
        selector_new_location: "New Location",
        selector_placeholder_location_select: "Select Place...",
        selector_search_more: "Search More",

        // Common Integration
        external_link: "External Link",
        loading_data: "Loading data...",
        btn_bgstats_open: "BG Stats Integration",
        btn_bgg_open: "BGG Dictionary Import",
        history_truncation_label: "Showing {displayed} of {total}",
    }
};

export type IntegrationTranslationKey = keyof typeof integrationTranslations['zh-TW'];

export const useIntegrationTranslation = () => {
    const { language } = useTranslation();
    const t = (key: IntegrationTranslationKey, params?: Record<string, string | number>): string => {
        const dict = (integrationTranslations[language] || integrationTranslations['zh-TW']) as any;
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

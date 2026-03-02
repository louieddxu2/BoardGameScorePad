
import { useTranslation } from './index';

export const dashboardTranslations = {
  'zh-TW': {
    // Search Empty State
    dash_create_btn: "建立計分板 \"{name}\"",
    dash_quick_play_btn: "建立並計分 \"{name}\"",

    // Quick Action Feedback
    dash_creating: "正在建立...",

    // --- Dashboard ---
    dash_search_placeholder: "搜尋遊戲...",
    dash_history_search_placeholder: "搜尋歷史紀錄...",
    dash_active_sessions: "進行中遊戲",
    dash_clear_all: "全部清空",
    dash_pinned: "已釘選",
    dash_my_library: "我的遊戲庫",
    dash_builtin_library: "內建遊戲庫",
    dash_new_games_found: "發現 {count} 個新遊戲",
    dash_install_app: "安裝 App",
    dash_no_records: "沒有紀錄",
    dash_no_records_hint: "如果是搜尋結果為空，請嘗試其他關鍵字。",
    dash_no_templates: "還沒有建立遊戲模板",
    dash_no_search_results: "沒有符合搜尋的遊戲",
    dash_search_result_count: "搜尋結果：{count} 筆",
    dash_search_result_limit: "顯示最近 100 筆",
    dash_add_new: "新增",
    dash_import_export: "資料管理",
    dash_cloud_sync: "同步與備份",
    dash_disconnect: "登出 Google Drive",
    dash_footer_count: "顯示 {displayed} 筆，共 {total} 筆",
    dash_unnamed_session: "未命名遊戲",
    dash_simple_template_desc: "簡易計分板",
    dash_switch_language: "切換語言",
    dash_pull_release_cloud: "放開管理雲端",
    dash_pull_release_search: "放開開始搜尋",

    // --- Messages (Dashboard) ---
    msg_json_copied: "JSON 已複製",
    msg_cloud_connect_first: "請先點擊上方雲端按鈕啟用連線",
    msg_read_template_failed: "讀取模板失敗",
    msg_copy_created: "已建立副本",
    msg_share_link_copied: "分享連結已複製",
    msg_cloud_share_failed: "分享失敗，請稍後再試",
    msg_share_ready_click_again: "連結已就緒，請再點擊一次即可複製",
    toast_pin_simple_success: "已建立並釘選簡易計分板",

    // --- Share Modal ---
    share_modal_title: "分享計分板",
    share_modal_loading: "正在產生雲端連結...",
    share_modal_desc: "任何人擁有此連結皆可匯入此計分板模板。",
    share_modal_copy_success: "連結已複製到剪貼簿",

    share_modal_local_title: "本地分享",
    share_modal_local_desc: "直接將模板內容複製為 JSON 字串。",
    share_modal_cloud_title: "雲端分享",
    share_modal_cloud_btn: "上傳至雲端並取得連結",
    share_modal_cloud_warning: "⚠️ 此操作會將計分板內容上傳至公開雲端，請勿上傳隱私資訊。",
    share_modal_img_note: "💡 提醒：背景圖片不會被上傳。",
    share_modal_uploading: "正在上傳...",

    // --- Game Card Actions ---
    card_resume: "繼續遊戲",
    card_start_new: "開始新遊戲",
    card_delete: "刪除",
    card_pin: "釘選",
    card_unpin: "取消釘選",
    card_copy_json: "複製 JSON",
    card_copy_share_link: "複製連結",
    card_cloud_backup: "備份到雲端",
    card_backup_hint: "有變更！點擊備份到 Google Drive",
    card_create_copy: "建立副本",
    card_restore_builtin: "備份並還原",
    card_img_ready: "背景圖已就緒",
    card_img_missing: "需下載或設定背景圖",

    // Dashboard Confirmations
    confirm_delete_template_title: "確定刪除此模板？",
    confirm_delete_template_msg: "此動作將無法復原。",
    confirm_delete_session_title: "確定刪除此進行中的遊戲嗎？",
    confirm_delete_session_msg: "您將遺失目前的計分進度。",
    confirm_delete_history_title: "確定刪除此紀錄？",
    confirm_clear_all_sessions_title: "清空所有進行中遊戲？",
    confirm_clear_all_sessions_msg: "此動作將刪除所有暫存進度，無法復原。",
    confirm_clear_all: "確認清空",
    confirm_restore_title: "還原預設值？",
    confirm_restore_msg: "目前的修改將會自動備份到「我的遊戲庫」，並還原至初始設定。",
  },
  'en': {
    // Search Empty State
    dash_create_btn: "Create Scoreboard \"{name}\"",
    dash_quick_play_btn: "Create & Score \"{name}\"",

    // Quick Action Feedback
    dash_creating: "Creating...",

    // --- Dashboard ---
    dash_search_placeholder: "Search games...",
    dash_history_search_placeholder: "Search history...",
    dash_active_sessions: "Active Sessions",
    dash_clear_all: "Clear All",
    dash_pinned: "Pinned",
    dash_my_library: "My Library",
    dash_builtin_library: "Built-in Library",
    dash_new_games_found: "Found {count} new games",
    dash_install_app: "Install App",
    dash_no_records: "No records found",
    dash_no_records_hint: "Try searching with different keywords.",
    dash_no_templates: "No templates created yet",
    dash_no_search_results: "No matching games found",
    dash_search_result_count: "Results: {count}",
    dash_search_result_limit: "Showing recent 100",
    dash_add_new: "New",
    dash_import_export: "Manage Data",
    dash_cloud_sync: "Sync & Backup",
    dash_disconnect: "Disconnect Drive",
    dash_footer_count: "Showing {displayed} of {total}",
    dash_unnamed_session: "Unnamed Session",
    dash_simple_template_desc: "Simple score sheet",
    dash_switch_language: "Switch Language",
    dash_pull_release_cloud: "Release to manage cloud",
    dash_pull_release_search: "Release to start search",

    // --- Messages (Dashboard) ---
    msg_json_copied: "JSON Copied",
    msg_cloud_connect_first: "Please connect to cloud first",
    msg_read_template_failed: "Failed to read template",
    msg_copy_created: "Copy created",
    msg_share_link_copied: "Share link copied",
    msg_cloud_share_failed: "Share failed, please try again",
    msg_share_ready_click_again: "Link ready! Please click again to copy",
    toast_pin_simple_success: "Simple score sheet created and pinned",

    // --- Share Modal ---
    share_modal_title: "Share Scoreboard",
    share_modal_loading: "Generating cloud link...",
    share_modal_desc: "Anyone with this link can import this scoreboard template.",
    share_modal_copy_success: "Link copied to clipboard",

    share_modal_local_title: "Local Export",
    share_modal_local_desc: "Copy template content directly as a JSON string.",
    share_modal_cloud_title: "Cloud Share",
    share_modal_cloud_btn: "Upload to Cloud & Get Link",
    share_modal_cloud_warning: "⚠️ This uploads content to a public cloud. Do not include private info.",
    share_modal_img_note: "💡 Note: Background images will not be uploaded.",
    share_modal_uploading: "Uploading...",

    // --- Game Card Actions ---
    card_resume: "Resume",
    card_start_new: "Start New",
    card_delete: "Delete",
    card_pin: "Pin",
    card_unpin: "Unpin",
    card_copy_json: "Copy JSON",
    card_copy_share_link: "Copy Link",
    card_cloud_backup: "Backup to Cloud",
    card_backup_hint: "Changes detected! Click to backup to Google Drive",
    card_create_copy: "Create Copy",
    card_restore_builtin: "Backup & Restore",
    card_img_ready: "Background Ready",
    card_img_missing: "Background Missing",

    // Dashboard Confirmations
    confirm_delete_template_title: "Delete this template?",
    confirm_delete_template_msg: "This action cannot be undone.",
    confirm_delete_session_title: "Discard active session?",
    confirm_delete_session_msg: "You will lose all current progress.",
    confirm_delete_history_title: "Delete this record?",
    confirm_clear_all_sessions_title: "Clear all active sessions?",
    confirm_clear_all_sessions_msg: "All draft progress will be lost permanently.",
    confirm_clear_all: "Confirm Clear",
    confirm_restore_title: "Restore Defaults?",
    confirm_restore_msg: "Current modifications will be backed up to 'My Library', and reset to original settings.",
  }
};

export type DashboardTranslationKey = keyof typeof dashboardTranslations['zh-TW'];

export const useDashboardTranslation = () => {
  const { language } = useTranslation();
  const t = (key: DashboardTranslationKey, params?: Record<string, string | number>) => {
    const dict = dashboardTranslations[language] || dashboardTranslations['zh-TW'];
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

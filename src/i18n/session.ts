import { useTranslation } from './index';

export const sessionTranslations = {
  'zh-TW': {
    // --- Session View ---
    session_edit_title_placeholder: "輸入標題",
    session_lock_edit: "鎖定編輯 (切換至使用模式)",
    session_unlock_edit: "解鎖編輯 (切換至編輯模式)",
    session_download_bg: "下載雲端背景圖",
    session_reset_confirm_title: "確定重置？",
    session_reset_confirm_msg: "此動作將清空所有已輸入的分數，且無法復原。",
    session_delete_col_title: "確定刪除此項目？",
    session_delete_col_msg: "刪除後，所有玩家在該項目的分數將會遺失。",
    session_upload_modal_title: "設定計分紙背景",
    session_upload_modal_desc: "此模板已包含框線設定。",
    session_upload_modal_cloud_btn: "從雲端下載",
    session_upload_modal_connect_btn: "連線並下載",
    session_upload_modal_camera: "拍攝新照片",
    session_upload_modal_gallery: "從相簿上傳",
    session_upload_modal_remove: "移除計分紙返回標準介面",
    session_exit_title: "即將返回目錄",
    session_exit_msg: "遊戲結束了嗎？",
    session_btn_draft: "暫存遊戲 (稍後再玩)",
    session_btn_finish: "結束遊戲 (儲存紀錄)",
    session_discard: "捨棄",
    session_end_confirm: '確定結束並儲存紀錄？',
    session_end_confirm_desc: '結束後，將結算分數並建立歷史記錄。',
    session_end_btn_end: '結束遊戲',
    session_end_btn_cancel: '繼續計分',
    session_action_end: '結束',
    session_action_share: '分享',
    session_action_options: '選項',

    // --- Modals common ---
    modal_or: "或",
    modal_no_cols: "沒有可複製的項目",

    // --- Add Column Modal ---
    modal_add_col_title: "新增計分項目",
    modal_copy_existing: "複製現有項目：",
    modal_copy_count: "複製 {count} 個選取項目",
    modal_add_blank: "建立全新空白項目",

    // --- Input Panel ---
    input_edit_player: "編輯玩家",
    input_total_adjust: "總分修正",
    input_clear: "清除",
    input_reset: "重置",
    input_next: "下一項",
    input_tie_breaker: "打破平手",
    input_force_loss: "強制落敗",
    input_auto_calc: "自動計算",
    input_auto_desc: "此欄位由公式自動產生結果。您無需手動輸入數值。",
    input_list_menu: "列表選單",
    input_calc_mode: "數值運算",
    input_rounding: "小數處理",
    input_not_scored: "此欄位不計入總分",
    input_prod_title: "乘積輸入",
    input_sum_title: "分項累加",
    input_lookup_title: "範圍查表",
    input_fixed_score: "固定分數",
    input_no_rule: "無規則",
    input_btn_enter: "輸入",
    input_placeholder_name: '變更玩家名稱',

    // --- Player Editor ---
    player_placeholder: "輸入名稱",
    player_color: "顏色",
    player_no_color: "無色",
    player_history: "歷史紀錄",
    player_no_history: "無紀錄",
    player_set_starter: "設為起始",
    player_is_starter: "起始玩家",
    player_default_name: '玩家',
    player_tab_info: '玩家資訊',
    player_tab_stats: '計分統計',
    player_stats_total: '目前分數',
    player_stats_rank: '目前排名',
    player_action_remove: '移除玩家',
    player_action_remove_confirm: '確定',

    // --- Photo / Screenshot Actions ---
    photo_modal_title: '分享結果',
    ss_generating: "正在繪製圖片...",
    ss_copy_success: "已複製到剪貼簿",
    ss_download_start: "下載已開始",
    photo_btn_capture: '截圖',
    photo_btn_delete: '刪除',
    photo_btn_share: '分享',
    photo_btn_download: '下載',
    photo_mode_full: '完整版',
    photo_mode_simple: '簡潔版',
    photo_share_text: '這是我們玩《{name}》的分數！',
    photo_msg_capture_fail: '無法測量佈局，截圖失敗。',
    photo_msg_share_fail: '分享失敗',
    photo_msg_share_success: '已下載圖片',
    photo_msg_share_no_support: '您的瀏覽器不支援直接分享圖片',
    photo_msg_copy_success: '已複製到剪貼簿',
    photo_msg_copy_fail: '複製失敗，請嘗試下載',
    photo_msg_generating: '正在繪製圖片...',
    photo_msg_preview_fail: '預覽載入失敗',
    photo_msg_no_photos: '尚無照片',
    photo_action_hide_score: '隱藏分數',
    photo_action_show_score: '顯示分數',
    photo_anon_title: '點擊以隱藏玩家姓名',

    // --- Photo Gallery ---
    gallery_title: "遊戲照片庫",
    gallery_upload: "上傳",
    gallery_camera: "拍照",
    gallery_loading: "載入照片中...",
    gallery_empty: "尚無照片",
    gallery_empty_hint: "點擊右上角的按鈕來新增這場遊戲的精彩時刻！",
    gallery_delete_confirm_title: "刪除照片？",
    gallery_delete_confirm_msg: "確定要刪除這張照片嗎？此動作無法復原。",
    gallery_generating_overlay: "正在合成計分表...",
    gallery_toggle_score: "顯示分數",
    gallery_hide_score: "隱藏分數",

    // --- Share Menu ---
    share_processing: '處理中...',
    share_preview: '預覽截圖',
    share_gallery: '照片圖庫',
    share_photo_count: "目前 {count} 張照片",
    share_camera_title: '拍照並儲存',
    share_set_bg: '設定計分紙背景',

    // --- Background Modal ---
    bg_modal_title: "設定計分紙背景",
    bg_modal_msg_has_visuals: "此模板已包含框線設定。",
    bg_modal_cloud_hint: "您可以從雲端還原背景，或重新拍攝。",
    bg_modal_local_hint: "請拍攝或上傳計分紙照片。",
    bg_btn_cloud_download: "從雲端下載",
    bg_btn_cloud_connect: "連線並下載",
    bg_btn_camera: "拍攝照片",
    bg_btn_upload: "從相簿上傳",
    bg_btn_remove: "移除計分紙背景",

    // --- Smart Spacer ---
    smart_spacer_hint: '點擊上方分數格開始輸入',
    smart_spacer_tools_title: '桌遊工具箱',

    // --- Grid ---
    grid_total_score: '總分',
    grid_add_column: '新增計分項目',
    column_name_default: '項目',
    settings_title: '遊戲設定',
    grid_player: "玩家",
    grid_hidden: "隱藏中",
    grid_overlay: "疊加模式",
    grid_toggle_toolbox: "開啟/關閉工具箱"
  },
  'en': {
    // --- Session View ---
    session_edit_title_placeholder: "Enter Title",
    session_lock_edit: "Lock Edit (Switch to Play Mode)",
    session_unlock_edit: "Unlock Edit (Switch to Edit Mode)",
    session_download_bg: "Download Background",
    session_reset_confirm_title: "Confirm Reset?",
    session_reset_confirm_msg: "This will clear all entered scores. This action cannot be undone.",
    session_delete_col_title: "Delete this Item?",
    session_delete_col_msg: "All player scores for this item will be lost.",
    session_upload_modal_title: "Set Score Sheet Background",
    session_upload_modal_desc: "This template includes layout coordinates.",
    session_upload_modal_cloud_btn: "Download from Cloud",
    session_upload_modal_connect_btn: "Connect & Download",
    session_upload_modal_camera: "Take New Photo",
    session_upload_modal_gallery: "Upload from Gallery",
    session_upload_modal_remove: "Remove Background & Revert to Standard",
    session_exit_title: "Return to Menu",
    session_exit_msg: "Is the game finished?",
    session_btn_draft: "Save Draft (Play Later)",
    session_btn_finish: "Finish Game (Save History)",
    session_discard: "Discard",
    session_end_confirm: 'End Game and Save?',
    session_end_confirm_desc: 'This will conclude the game and create a history record.',
    session_end_btn_end: 'End Game',
    session_end_btn_cancel: 'Cancel',
    session_action_end: 'End',
    session_action_share: 'Share',
    session_action_options: 'Options',

    // --- Modals common ---
    modal_or: "or",
    modal_no_cols: "No items to copy",

    // --- Add Column Modal ---
    modal_add_col_title: "Add Item",
    modal_copy_existing: "Copy existing:",
    modal_copy_count: "Copy {count} selected",
    modal_add_blank: "Create new blank item",

    // --- Input Panel ---
    input_edit_player: "Edit Player",
    input_total_adjust: "Total Adjustment",
    input_clear: "Clear",
    input_reset: "Reset",
    input_next: "Next",
    input_tie_breaker: "Tie Breaker",
    input_force_loss: "Force Loss",
    input_auto_calc: "Auto Calc",
    input_auto_desc: "This field is calculated automatically. No manual input required.",
    input_list_menu: "List Menu",
    input_calc_mode: "Calculator",
    input_rounding: "Rounding",
    input_not_scored: "Not included in total",
    input_prod_title: "Product Input",
    input_sum_title: "Sum Parts",
    input_lookup_title: "Lookup Table",
    input_fixed_score: "Fixed Score",
    input_no_rule: "No Rule",
    input_btn_enter: "Enter",
    input_placeholder_name: 'Change player name',

    // --- Player Editor ---
    player_placeholder: "Enter Name",
    player_color: "Color",
    player_no_color: "None",
    player_history: "History",
    player_no_history: "No history",
    player_set_starter: "Set Starter",
    player_is_starter: "Starter",
    player_default_name: 'Player',
    player_tab_info: 'Player Info',
    player_tab_stats: 'Score Stats',
    player_stats_total: 'Current Score',
    player_stats_rank: 'Current Rank',
    player_action_remove: 'Remove Player',
    player_action_remove_confirm: 'Confirm',

    // --- Photo / Screenshot Actions ---
    photo_modal_title: 'Share Results',
    ss_generating: "Generating...",
    ss_copy_success: "Copied to clipboard",
    ss_download_start: "Download started",
    photo_btn_capture: 'Capture',
    photo_btn_delete: 'Delete',
    photo_btn_share: 'Share',
    photo_btn_download: 'Download',
    photo_mode_full: 'Full',
    photo_mode_simple: 'Simple',
    photo_share_text: 'Check out our scores for {name}!',
    photo_msg_capture_fail: 'Capture failed',
    photo_msg_share_fail: 'Share failed',
    photo_msg_share_success: 'Image downloaded',
    photo_msg_share_no_support: 'Your browser does not support direct sharing',
    photo_msg_copy_success: 'Copied to clipboard',
    photo_msg_copy_fail: 'Copy failed, please download instead',
    photo_msg_generating: 'Generating image...',
    photo_msg_preview_fail: 'Preview failed',
    photo_msg_no_photos: 'No photos yet',
    photo_action_hide_score: 'Hide Score',
    photo_action_show_score: 'Show Score',
    photo_anon_title: 'Tap to hide name',

    // --- Photo Gallery ---
    gallery_title: "Game Photos",
    gallery_upload: "Upload",
    gallery_camera: "Camera",
    gallery_loading: "Loading...",
    gallery_empty: "No Photos",
    gallery_empty_hint: "Capture the moments!",
    gallery_delete_confirm_title: "Delete Photo?",
    gallery_delete_confirm_msg: "Are you sure? This cannot be undone.",
    gallery_generating_overlay: "Generating Overlay...",
    gallery_toggle_score: "Show Score",
    gallery_hide_score: "Hide Score",

    // --- Share Menu ---
    share_processing: 'Processing...',
    share_preview: 'Preview',
    share_gallery: 'Gallery',
    share_photo_count: "{count} Photos",
    share_camera_title: 'Take & Save',
    share_set_bg: 'Set Background',

    // --- Background Modal ---
    bg_modal_title: "Set Score Sheet Background",
    bg_modal_msg_has_visuals: "This template includes layout guides.",
    bg_modal_cloud_hint: "You can restore background from cloud or take a new photo.",
    bg_modal_local_hint: "Please take or upload a score sheet photo.",
    bg_btn_cloud_download: "Download from Cloud",
    bg_btn_cloud_connect: "Connect & Download",
    bg_btn_camera: "Take Photo",
    bg_btn_upload: "Upload from Gallery",
    bg_btn_remove: "Remove Background",

    // --- Smart Spacer ---
    smart_spacer_hint: 'Tap a score cell to start',
    smart_spacer_tools_title: 'Game Toolbox',

    // --- Grid ---
    grid_total_score: 'Total',
    grid_add_column: 'Add Column',
    column_name_default: 'Item',
    settings_title: 'Game Settings',
    grid_player: "Player",
    grid_hidden: "Hidden",
    grid_overlay: "Overlay",
    grid_toggle_toolbox: "Toggle Toolbox"
  },
};

export type SessionTranslationKey = keyof typeof sessionTranslations['zh-TW'];

export const useSessionTranslation = () => {
  const { language } = useTranslation();
  const t = (key: SessionTranslationKey, params?: Record<string, string | number>): string => {
    const dict = (sessionTranslations[language] || sessionTranslations['zh-TW']) as any;
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

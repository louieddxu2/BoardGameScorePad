
// 專屬於 SystemDataInspector 的翻譯檔
// 採用模組化設計，只有當 Inspector 介面被開啟時，此檔案才會被載入

export const inspectorTranslations = {
  'zh-TW': {
    title: "系統資料檢視器",
    subtitle: "除錯控制台與資料庫管理",
    
    // Tabs
    tab_games: "遊戲",
    tab_players: "玩家",
    tab_locations: "地點",
    tab_time: "時間統計",
    tab_counts: "人數統計",
    tab_modes: "模式統計", 
    tab_weights: "權重模型", 
    tab_images: "圖片儲存",
    tab_bgg: "BGG 快取", 
    tab_session: "短期記憶", // New
    tab_db: "資料庫總覽",

    // Headers & Lists
    list_games: "已存遊戲",
    list_players: "已存玩家",
    list_locations: "已存地點",
    list_weekdays: "星期統計 (0-6)",
    list_timeslots: "時段統計 (0-7)",
    list_counts: "玩家人數統計",
    list_modes: "遊戲模式統計", 
    list_images: "本地圖片庫",
    list_bgg: "BGG 資料庫", 
    list_session: "本次會話 (Session Context)", // New
    list_db_tables: "資料表統計",
    
    // Empty States
    loading: "讀取資料庫中...",
    no_data_category: "此分類尚無資料。",
    select_hint: "選擇項目以查看詳細資訊",
    no_relations: "無關聯資料",

    // Detail Panel
    usage_count: "使用次數",
    last_used: "最後使用",
    relations_analysis: "關聯分析",
    filtered: "已篩選",
    full_dump: "完整資料 (JSON)",

    // Image Inspector
    img_total_size: "總佔用空間",
    img_count: "圖片數量",
    img_avg_size: "平均大小",
    img_type_template: "模板背景",
    img_type_session: "遊戲照片",
    img_delete_hint: "點擊 ID 可預覽或刪除",

    // DB Inspector
    db_total_size: "預估總容量",
    db_table_name: "資料表名稱",
    db_row_count: "筆數",
    db_est_size: "預估大小",
    db_calc_note: "* 容量為估算值 (JSON 字串長度 / Blob 大小)",

    // Weights Inspector
    // [Updated] More specific naming
    weights_title: "全域預測模型",
    weights_subtitle: "檢視各個推薦系統的影響因子權重",
    
    engine_player_title: "玩家預測 (Context → Player)",
    engine_player_desc: "根據遊戲、地點、時間等環境因素，預測本次參與的玩家。",

    engine_count_title: "人數預測 (Context → Count)",
    engine_count_desc: "根據遊戲、地點、時間等環境因素，預測最可能的玩家人數。",

    engine_location_title: "地點預測 (Context → Location)",
    engine_location_desc: "根據遊戲、人數、時間等因素，預測最可能的地點。",
    
    weight_factor: "影響因子",
    weight_value: "權重",
    
    factor_game: "遊戲種類",
    factor_location: "遊玩地點",
    factor_weekday: "星期幾",
    factor_timeSlot: "時段",
    factor_playerCount: "玩家人數",
    factor_gameMode: "遊戲模式",
    factor_relatedPlayer: "玩家人脈 (P2P)", 
    factor_sessionContext: "短期記憶", // New
    
    btn_reset_weights: "重置此模型",

    // Relation Categories
    rel_players: "常玩玩家",
    rel_locations: "常去地點",
    rel_games: "關聯遊戲",
    rel_colors: "偏好顏色",
    rel_weekdays: "熱門星期",
    rel_timeslots: "熱門時段",
    rel_player_counts: "常開人數",
    rel_modes: "常玩模式", // New

    // Confirmations
    confirm_reset_title: "危險：清空統計資料庫",
    confirm_reset_msg: "確定要執行嗎？\n\n1. 所有玩家、地點、遊戲的「列表」將被清空。\n2. 歷史紀錄本身不會被刪除。\n3. 您之後需要點擊「重新掃描」來重建列表。",
    confirm_reprocess_title: "重新掃描歷史紀錄",
    confirm_reprocess_msg: "系統將遍歷所有歷史紀錄，重新建立玩家、地點與遊戲的關聯數據。\n\n這將自動補齊遺失的統計資料。",
    confirm_factory_reset_title: "危險：恢復原廠設定",
    confirm_factory_reset_msg: "⚠️警告：此動作將刪除所有資料！⚠️\n\n包含：\n- 所有歷史紀錄\n- 所有自訂模板\n- 所有圖片與照片\n- 所有玩家與地點資料\n- BG Stats 匯入資料\n\nApp 將會重新載入並回到初始狀態。",
    btn_reprocess: "開始掃描",
    btn_reset: "確認清空",
    btn_factory_reset: "⚠️ 刪除所有資料 (Factory Reset) ⚠️",
  },
  'en': {
    title: "System Data Inspector",
    subtitle: "Debug Console & Library Manager",

    // Tabs
    tab_games: "Games",
    tab_players: "Players",
    tab_locations: "Locations",
    tab_time: "Time Stats",
    tab_counts: "Player Counts",
    tab_modes: "Mode Stats", 
    tab_weights: "Weights", 
    tab_images: "Storage",
    tab_bgg: "BGG Cache",
    tab_session: "Session Memory", // New
    tab_db: "DB Overview",

    // Headers & Lists
    list_games: "Saved Games",
    list_players: "Saved Players",
    list_locations: "Saved Locations",
    list_weekdays: "Weekdays (0-6)",
    list_timeslots: "Time Slots (0-7)",
    list_counts: "Player Count Stats",
    list_modes: "Game Mode Stats", 
    list_images: "Local Images",
    list_bgg: "BGG Database", 
    list_session: "Current Session Context", // New
    list_db_tables: "Table Statistics",

    // Empty States
    loading: "Loading DB...",
    no_data_category: "No data found in this category.",
    select_hint: "Select an item to inspect details",
    no_relations: "No relations data",

    // Detail Panel
    usage_count: "Usage Count",
    last_used: "Last Used",
    relations_analysis: "Relations Analysis",
    filtered: "Filtered",
    full_dump: "Full Dump (JSON)",

    // Image Inspector
    img_total_size: "Total Size",
    img_count: "Image Count",
    img_avg_size: "Avg Size",
    img_type_template: "Template BG",
    img_type_session: "Session Photo",
    img_delete_hint: "Click ID to preview/delete",

    // DB Inspector
    db_total_size: "Est. Total Size",
    db_table_name: "Table Name",
    db_row_count: "Rows",
    db_est_size: "Est. Size",
    db_calc_note: "* Size is estimated (JSON string length / Blob size)",

    // Weights Inspector
    // [Updated] More specific naming
    weights_title: "Prediction Models",
    weights_subtitle: "Adjust influence weights for various recommendation engines",

    engine_player_title: "Player Predictor (Context → Player)",
    engine_player_desc: "Predicts players based on context like game, location, and time.",

    engine_count_title: "Count Predictor (Context → Count)",
    engine_count_desc: "Predicts optimal player count based on game and environment.",

    engine_location_title: "Location Predictor (Context → Location)",
    engine_location_desc: "Predicts likely locations based on game, count, and environment.",

    weight_factor: "Factor",
    weight_value: "Weight",
    
    factor_game: "Game",
    factor_location: "Location",
    factor_weekday: "Weekday",
    factor_timeSlot: "Time Slot",
    factor_playerCount: "Player Count",
    factor_gameMode: "Game Mode",
    factor_relatedPlayer: "Friendship (P2P)", 
    factor_sessionContext: "Short-term Memory", // New
    
    btn_reset_weights: "Reset Model",

    // Relation Categories
    rel_players: "Top Players",
    rel_locations: "Top Locations",
    rel_games: "Related Games",
    rel_colors: "Top Colors",
    rel_weekdays: "Top Days",
    rel_timeslots: "Top Times",
    rel_player_counts: "Top Counts",
    rel_modes: "Top Modes", // New

    // Confirmations
    confirm_reset_title: "Danger: Reset Stats DB",
    confirm_reset_msg: "Are you sure?\n\n1. All saved lists (players, locations) will be WIPED.\n2. History records will NOT be deleted.\n3. You will need to 'Rescan' to rebuild lists.",
    confirm_reprocess_title: "Rescan History",
    confirm_reprocess_msg: "This will iterate through all history records to rebuild associations and stats.\n\nThis may take a moment.",
    confirm_factory_reset_title: "Danger: Factory Reset",
    confirm_factory_reset_msg: "⚠️ WARNING: This will delete EVERYTHING! ⚠️\n\nIncludes:\n- All History Records\n- All Custom Templates\n- All Images\n- All Players & Locations\n\nThe App will reload to initial state.",
    btn_reprocess: "Start Scan",
    btn_reset: "Confirm Reset",
    btn_factory_reset: "⚠️ DELETE ALL DATA (Factory Reset) ⚠️",
  }
};

export type InspectorTranslationKey = keyof typeof inspectorTranslations['zh-TW'];


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

    // Headers & Lists
    list_games: "已存遊戲",
    list_players: "已存玩家",
    list_locations: "已存地點",
    list_weekdays: "星期統計 (0-6)",
    list_timeslots: "時段統計 (0-7)",
    
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

    // Relation Categories
    rel_players: "常玩玩家",
    rel_locations: "常去地點",
    rel_games: "關聯遊戲",
    rel_colors: "偏好顏色",
    rel_weekdays: "熱門星期",
    rel_timeslots: "熱門時段",
  },
  'en': {
    title: "System Data Inspector",
    subtitle: "Debug Console & Library Manager",

    // Tabs
    tab_games: "Games",
    tab_players: "Players",
    tab_locations: "Locations",
    tab_time: "Time Stats",

    // Headers & Lists
    list_games: "Saved Games",
    list_players: "Saved Players",
    list_locations: "Saved Locations",
    list_weekdays: "Weekdays (0-6)",
    list_timeslots: "Time Slots (0-7)",

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

    // Relation Categories
    rel_players: "Top Players",
    rel_locations: "Top Locations",
    rel_games: "Related Games",
    rel_colors: "Top Colors",
    rel_weekdays: "Top Days",
    rel_timeslots: "Top Times",
  }
};

export type InspectorTranslationKey = keyof typeof inspectorTranslations['zh-TW'];

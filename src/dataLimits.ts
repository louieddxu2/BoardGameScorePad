
/**
 * 系統資料上限設定檔
 * 集中管理應用程式中各類資料結構的數量限制，方便未來效能調優與維護。
 */

export const DATA_LIMITS = {
  // --- 關聯分析系統 (Relationship Service) ---
  RELATION: {
    /** 一般實體關聯上限 (玩家、地點、遊戲、顏色) */
    DEFAULT_LIST_SIZE: 50,
    /** 時間相關關聯上限 (星期、時段) - 雖然目前固定只有 7 或 8 個，保留擴充性 */
    TIME_LIST_SIZE: 50,
  },

  // --- 資料庫查詢限制 (Live Queries) ---
  // 定義在 UI 列表中一次載入的最大筆數，避免大量資料導致介面卡頓。
  // 這些數值影響 "useAppQueries.ts"
  QUERY: {
    /** 模板列表 (我的遊戲庫) 顯示上限 */
    USER_TEMPLATES: 50,
    /** 內建遊戲庫列表 顯示上限 */
    BUILTIN_TEMPLATES: 50,
    /** 歷史紀錄列表 顯示上限 */
    HISTORY_RECORDS: 50,
    /** 下拉選單/預測列表 (玩家、地點) 最大載入筆數 */
    SAVED_LIST_ITEMS: 50,
    
    /** 
     * 資料庫檢索上限 
     * 用於搜尋與統計總數。需大於顯示上限，以確保能搜尋到較舊的資料並計算正確的總筆數。
     */
    FETCH_CAP: 1000,
  },

  // --- 編輯器限制 (Template Editor) ---
  EDITOR: {
    /** 單一計分板允許的最大欄位數量 (避免版面崩潰或效能問題) */
    MAX_COLUMNS: 50,
  },

  // --- 雲端備份限制 (Cloud Service) ---
  CLOUD: {
    /** 雲端垃圾桶保留的最大檔案數量 (超過此數量時，最舊的檔案將被永久刪除) */
    TRASH_RETENTION_COUNT: 100,
  },

  // --- ID 生成長度設定 (ID Generator) ---
  ID_LENGTH: {
    /** 標準 UUID (用於 Template, Session, History 等主要實體) */
    UUID: 36,
    /** 短 ID (用於 Column, Player, Location 等次要實體) */
    DEFAULT: 8,
    /** 極短 ID (用於 QuickAction 等大量重複的子項目) */
    SHORT: 6,
  }
};

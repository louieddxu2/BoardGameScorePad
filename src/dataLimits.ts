
/**
 * 系統資料上限設定檔
 * 集中管理應用程式中各類資料結構的數量限制，方便未來效能調優與維護。
 */

export const DATA_LIMITS = {
  // --- 關聯分析系統 (Relationship Service) ---
  // 定義在 SavedListItem.meta.relations 中，每個類別保留多少筆「最強關聯」的資料。
  // 當關聯數量超過此值時，計數最低（最不常發生）的關聯將被移除。
  // 這些數值影響 "relationshipService.ts"
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
    /** 模板列表 (我的遊戲庫) 最大載入筆數 */
    USER_TEMPLATES: 200,
    /** 內建遊戲庫列表 最大載入筆數 */
    BUILTIN_TEMPLATES: 100,
    /** 歷史紀錄列表 最大載入筆數 */
    HISTORY_RECORDS: 100,
    /** 下拉選單/預測列表 (玩家、地點) 最大載入筆數 */
    SAVED_LIST_ITEMS: 50,
  },

  // --- 編輯器限制 (Template Editor) ---
  // 這些數值影響 "TemplateEditor.tsx"
  EDITOR: {
    /** 單一計分板允許的最大欄位數量 (避免版面崩潰或效能問題) */
    MAX_COLUMNS: 50,
  },

  // --- 雲端備份限制 (Cloud Service) ---
  // 這些數值影響 "googleDrive.ts"
  CLOUD: {
    /** 雲端垃圾桶保留的最大檔案數量 (超過此數量時，最舊的檔案將被永久刪除) */
    TRASH_RETENTION_COUNT: 100,
  },

  // --- ID 生成長度設定 (ID Generator) ---
  // 影響全站的 ID 生成邏輯
  ID_LENGTH: {
    /** 標準 UUID (用於 Template, Session, History 等主要實體) - 對應 generateId() 預設值 */
    UUID: 36,
    /** 短 ID (用於 Column, Player, Location 等次要實體) - 取代 generateId(8) */
    DEFAULT: 8,
    /** 極短 ID (用於 QuickAction 等大量重複的子項目) - 取代 generateId(6) */
    SHORT: 6,
  }
};


export interface GameOption {
  // --- 1. 索引指標 (Data Pointers) ---
  // 這些 ID 用於決定點擊後的行為與資料來源
  
  /** 
   * 指向 templates 或 builtins 表
   * 若存在，代表此遊戲有「專屬計分板結構」(Columns) 
   */
  templateId?: string;

  /** 
   * 指向 savedGames 表
   * 若存在，代表此遊戲存在於使用者的「遊戲清單」中 (有遊玩次數統計)
   */
  savedGameId?: string;

  /** 
   * 指向 bggGames 表
   * 若存在，代表此遊戲關聯到了 BGG 資料庫 (用於封面圖、連結)
   */
  bggId?: string;

  // --- 2. 顯示資訊 (Display Info) ---
  
  /** React 列表渲染用的唯一 Key (通常由 templateId 或 savedGameId 充當) */
  uid: string;
  
  /** 列表上顯示的主要名稱 (可能包含備註括號) */
  displayName: string;
  
  /** [New] 用於儲存/釘選的純淨名稱 (不含括號備註) */
  cleanName?: string;
  
  /** [New] BGG 原名 (用於搜尋結果顯示輔助) */
  bggName?: string;

  /** 封面圖片網址 (優先取自 Template，其次取自 BGG) */
  coverUrl?: string;

  // --- 3. 排序權重 (Sorting Weights) ---
  
  /** 排序依據 (Recency)。取 Template 修改時間與 SavedGame 遊玩時間的較大者。 */
  lastUsed: number;
  
  /** 排序依據 (Frequency) */
  usageCount: number;
  
  /** 置頂權重 */
  isPinned: boolean;

  // --- 4. 啟動預設值 (Launch Preferences) ---
  
  /** 預設玩家人數 */
  defaultPlayerCount: number;
  
  /** 預設勝負規則 */
  defaultScoringRule: string;

  // --- 5. BGG Metadata (Rich Display) ---
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  complexity?: number;
  /** BGG 投票的最佳人數列表 */
  bestPlayers?: number[];

  // --- 6. 搜尋索引 (Search Index) ---
  
  /** 供 Fuse.js 搜尋，包含名稱、別名、ID */
  _searchTokens: string[];
}

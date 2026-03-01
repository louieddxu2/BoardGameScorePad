
// --- Formula-based structure ---
export interface ScoreValue {
  parts: number[];
  optionId?: string; // [New] 記錄列表選單中具體選中的選項 ID，解決數值相同導致顯示錯誤的問題
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContentLayout {
  x: number;      // 0-100 percentage
  y: number;      // 0-100 percentage
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
}

export interface ColumnVisuals {
  headerRect?: Rect; // Crop coordinates for the header/label
  cellRect?: Rect;   // Crop coordinates for the input cell
}

export interface GlobalVisuals {
  aspectRatio?: number;    // [New] Width / Height ratio of the original rectified image. Used to enforce consistent geometry for other users.
  playerLabelRect?: Rect;  // Crop coordinates for the top-left label (usually says "Player" or empty)
  playerHeaderRect?: Rect; // Crop coordinates for the top row (Player Names)
  totalRowRect?: Rect;     // Crop coordinates for the bottom row (Total Score)
  totalLabelRect?: Rect;   // Crop coordinates for the "Total" label (bottom-left)

  // Mask Rects (Used for screenshot reconstruction)
  topMaskRect?: Rect;
  bottomMaskRect?: Rect;
  leftMaskRect?: Rect;
  rightMaskRect?: Rect;
}

export interface ScoreColumn {
  id: string;
  name: string;
  color?: string;

  // Core Calculation Logic
  formula: string; // e.g., "a1", "a1×c1", "a1+next", "f1(a1)", "a1×a2"
  constants?: {
    c1?: number;
  };

  // 函數定義：支援 f1, f2... 多個函數
  f1?: MappingRule[]; // 保留舊欄位以相容舊資料
  functions?: Record<string, MappingRule[]>; // 新格式：{"f1": rules, "f2": rules}

  // Automatic Calculation Config
  isAuto?: boolean;
  variableMap?: Record<string, {
    id: string;
    name: string;
    mode?: 'value' | 'rank_score' | 'rank_player' | 'tie_count';
  }>; // Maps "x1" -> { id: "uuid", name: "Column Name", mode: "..." }

  // Input & UI Helpers
  inputType: InputMethod;
  quickActions?: QuickAction[];

  // Formatting & Display
  unit?: string;
  subUnits?: [string, string];
  rounding?: RoundingMode;
  showPartsInGrid?: boolean | 'parts_only';
  renderMode?: 'standard' | 'value_only' | 'label_only'; // For select/clicker columns
  buttonGridColumns?: number;

  // Display Control
  displayMode?: 'row' | 'overlay' | 'hidden';

  // Visual Mapping
  visuals?: ColumnVisuals;

  // Layout Configuration
  contentLayout?: ContentLayout;

  // Meta
  isScoring: boolean;
}

export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type InputMethod = 'keypad' | 'clicker' | 'auto';

export interface MappingRule {
  min?: number;
  max?: number | 'next';
  score: number;

  isLinear?: boolean;
  unitScore?: number;
  unit?: number;
}

export interface QuickAction {
  id: string;
  label: string;
  value: number;
  color?: string;
  isModifier?: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  scores: Record<string, ScoreValue>;
  totalScore: number;
  isStarter?: boolean; // New: Starting player marker
  linkedPlayerId?: string; // [New] 指向歷史紀錄的 UUID，用於關聯分析
  isColorManuallySet?: boolean; // [New] 指示此顏色是否為使用者手動選擇 (用於過濾雜訊)

  // New: Total Score Adjustment Logic
  bonusScore?: number; // Manually added bonus/penalty to total
  tieBreaker?: boolean; // Wins ties
  isForceLost?: boolean; // Cannot win regardless of score
}

export type ScoringRule = 'HIGHEST_WINS' | 'LOWEST_WINS' | 'COOP' | 'COMPETITIVE_NO_SCORE' | 'COOP_NO_SCORE';

// [New Interface] Separate preferences from template definition
export interface TemplatePreference {
  templateId: string;
  lastPlayerCount?: number;
  defaultScoringRule?: ScoringRule;
  updatedAt?: number;
}

// [New Interface] Local Image Storage
export interface LocalImage {
  id: string;          // UUID
  relatedId: string;   // Template ID or Session ID
  relatedType: 'template' | 'session';
  blob: Blob;          // Binary data
  mimeType: string;
  createdAt: number;
  cloudId?: string;    // Google Drive File ID (for sync mapping)
  isSynced?: boolean;  // Whether it has been uploaded
}

/**
 * [Core Interface] 遊戲身分識別
 * 定義了「這是一個什麼遊戲」的最小資訊集。
 * 所有涉及遊戲實體的介面 (Template, Session, SavedItem) 都應繼承此介面。
 */
export interface GameIdentity {
  name: string;      // 遊戲顯示名稱
  bggId?: string;    // BoardGameGeek ID (外部關聯鍵)
}

export interface GameTemplate extends GameIdentity {
  id: string;
  // name: string; // Inherited from GameIdentity
  // bggId?: string; // Inherited from GameIdentity

  description?: string;

  supportedColors?: string[]; // [New] Custom color palette sequence for this game
  columns: ScoreColumn[];
  createdAt: number;
  updatedAt?: number;
  lastSyncedAt?: number;
  // [Removed] isPinned is now managed externally by pinnedIds list
  hasImage?: boolean;
  imageId?: string;       // [Offline] ID pointing to LocalImage table
  cloudImageId?: string;  // [Cloud] ID pointing to Google Drive
  globalVisuals?: GlobalVisuals;
  lastPlayerCount?: number; // 兼容舊資料，優先使用 TemplatePreference
  defaultScoringRule?: ScoringRule; // 兼容舊資料，優先使用 TemplatePreference

  // [New Phase 1] Fork Mechanism
  sourceTemplateId?: string;
}

export interface GameSession extends GameIdentity {
  id: string;
  templateId: string;

  // name: string; // Inherited from GameIdentity
  // bggId?: string; // Inherited from GameIdentity

  startTime: number;
  lastUpdatedAt?: number; // [New] 最後操作時間，用於排序與同步
  players: Player[];
  status: 'active' | 'completed';
  scoringRule?: ScoringRule; // 當次遊戲的勝利條件
  photos?: string[]; // List of LocalImage IDs (Session Photos)
  photoCloudIds?: Record<string, string>; // [New] Map<LocalUUID, CloudFileID> for direct access
  cloudFolderId?: string; // [Cloud] 在 Google Drive 上的資料夾 ID (位於 _Active 或 _History)
  location?: string; // [New] 進行中遊戲的地點
  locationId?: string; // [New] 地點 ID
  note?: string; // [New] 進行中遊戲的備忘錄 (將同步至歷史紀錄的 note)
}

// [New Interface] History Record
// HistoryRecord 暫時保持 gameName 屬性以維持與舊資料的相容性，
// 但我們手動加上 bggId 使其在概念上與 GameIdentity 保持一致。
export interface HistoryRecord {
  id: string; // [Changed] 使用 UUID (與 Session ID 相同)，不再是 number
  templateId: string; // 原始模板 ID (用於關聯)

  gameName: string; // 當時的遊戲名稱 (快照)
  // [BGG Link] 記錄這場遊戲對應的 BGG ID
  bggId?: string;

  startTime: number;
  endTime: number;
  updatedAt?: number; // [New] 紀錄最後修改時間 (例如修改筆記)
  players: Player[]; // 包含最終分數的玩家資料 (快照)
  winnerIds: string[]; // 贏家 ID 列表
  snapshotTemplate: GameTemplate; // [關鍵] 完整的模板快照 (含欄位、圖片ID等)
  location?: string; // 地點
  locationId?: string; // [New] 地點 ID (用於關聯分析)
  note?: string; // 筆記
  photos?: string[]; // List of LocalImage IDs
  photoCloudIds?: Record<string, string>; // [New] Map<LocalUUID, CloudFileID>
  cloudFolderId?: string; // [Cloud] 備份資料夾 ID

  // [v25 Migration] 提升為頂層屬性，減少對 snapshotTemplate 的依賴
  scoringRule?: ScoringRule;
}

// [New Type] 資料處理狀態
export type AnalyticsStatus = 'processed' | 'missing_location';

// [New Interface] 統計處理記錄表 (Local Only)
export interface AnalyticsLog {
  historyId: string; // PK
  status: AnalyticsStatus;
  lastProcessedAt: number;
}

// [New Interface] Dedicated BGG Game Data Storage
// 這是您要求的獨立架構，專門用來儲存 BGG 資料
export interface BggGame {
  id: string; // BGG ID (Primary Key)
  name: string; // Official Name (from BGG)
  altNames?: string[]; // [New] Aliases / Alternative Names (e.g. Chinese Name)
  year?: number;
  designers?: string;

  // Game Specs
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  minAge?: number;

  // Advanced Stats
  rank?: number; // BGG Rank
  complexity?: number; // Weight (1-5)
  bestPlayers?: number[]; // Community voted best player counts

  updatedAt: number; // Last cache update
}

// [New Interface] Generic Saved List Item (for Players, Locations, etc.)
export interface SavedListItem extends GameIdentity {
  id: string; // Internal 8-char ID (Base62) OR UUID

  // name: string; // Inherited from GameIdentity
  // bggId?: string; // Inherited from GameIdentity (Only used if this item IS a game)

  lastUsed: number;
  usageCount: number;

  meta?: {
    uuid?: string; // Legacy field
    stats?: {
      weekDays?: number[]; // 0-6 (Sun-Sat)
      timeSlots?: number[]; // 0-11 (2-hour buckets)
    };
    // Generic container for relations
    // key: 'players' | 'locations' | 'games' | 'colors' ...
    relations?: Record<string, any>;
    confidence?: Record<string, number>;

    // 注意：BGG Metadata 應優先從 bggGames 資料表讀取
    // 這裡僅保留作為快取或舊資料相容
    [key: string]: any;
  };
}

// [v24 New] System Weight Configuration
// 儲存全域的推薦權重設定，支援未來擴充不同類型的投票系統
export interface SystemWeightConfig {
  id: string; // e.g., 'player_recommendation'
  weights: Record<string, number>; // e.g., { location: 1.2, game: 0.8 }
  updatedAt: number;
}

export interface SystemPreferences {
  updatedAt: number;
  appSettings: {
    theme: 'dark' | 'light';
    zoomLevel: number;
    isEditMode: boolean;
  };
  uiState: {
    pinnedTemplateIds: string[];
    newBadgeIds: string[];
  };
}

export interface SystemLibrary {
  updatedAt: number;
  savedPlayers: SavedListItem[];
  savedLocations: SavedListItem[];
}

export interface TemplateShareCache {
  templateId: string;
  templateUpdatedAt: number;
  cloudId: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TEMPLATE_CREATOR = 'TEMPLATE_CREATOR',
  ACTIVE_SESSION = 'ACTIVE_SESSION',
  HISTORY_REVIEW = 'HISTORY_REVIEW',
}

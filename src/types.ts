
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
  id:string;
  name: string;
  color: string;
  scores: Record<string, ScoreValue>; 
  totalScore: number;
  isStarter?: boolean; // New: Starting player marker
  linkedPlayerId?: string; // [New] 指向歷史紀錄的 UUID，用於關聯分析
  
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

export interface GameTemplate {
  id: string;
  name: string;
  description?: string;
  bggId?: string; // [New] BoardGameGeek ID
  supportedColors?: string[]; // [New] Custom color palette sequence for this game
  columns: ScoreColumn[];
  createdAt: number;
  updatedAt?: number;    
  lastSyncedAt?: number; 
  isPinned?: boolean; 
  hasImage?: boolean;
  imageId?: string;       // [Offline] ID pointing to LocalImage table
  cloudImageId?: string;  // [Cloud] ID pointing to Google Drive
  globalVisuals?: GlobalVisuals;
  lastPlayerCount?: number; // 兼容舊資料，優先使用 TemplatePreference
  defaultScoringRule?: ScoringRule; // 兼容舊資料，優先使用 TemplatePreference
  
  // [New Phase 1] Fork Mechanism
  // 如果此欄位存在，代表此模板是針對某個內建模板 (或未來其他模板) 的修改版 (Fork/Override)
  // 原本的 id 會是一個新的 UUID，而 sourceTemplateId 則指向原始內建 ID (例如 "Built-in-Agricola")
  sourceTemplateId?: string; 
}

export interface GameSession {
  id: string;
  templateId: string;
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
}

// [New Interface] History Record
export interface HistoryRecord {
  id: string; // [Changed] 使用 UUID (與 Session ID 相同)，不再是 number
  templateId: string; // 原始模板 ID (用於關聯)
  gameName: string; // 當時的遊戲名稱 (快照)
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
}

// [New Type] 資料處理狀態
export type AnalyticsStatus = 'processed' | 'missing_location';

// [New Interface] 統計處理記錄表 (Local Only)
// 這張表紀錄每一筆 HistoryRecord 是否已經被納入 SavedLists (玩家、地點、遊戲) 的統計中
export interface AnalyticsLog {
  historyId: string; // PK
  status: AnalyticsStatus;
  lastProcessedAt: number;
}

// [New Interface] Generic Saved List Item (for Players, Locations, etc.)
export interface SavedListItem {
  id: string; // [Changed] UUID
  name: string;
  lastUsed: number;
  usageCount: number;
  predictivePower?: number; // [New] 0.2 ~ 5.0, Default 1.0. 代表此項目作為預測來源時的可信度權重。
  meta?: {
      uuid?: string; // Legacy field (can be deprecated eventually as id is now uuid)
      stats?: {
          weekDays?: number[]; // 0-6 (Sun-Sat)
          timeSlots?: number[]; // 0-11 (2-hour buckets)
      };
      // Generic container for relations
      // key: 'players' | 'locations' | 'games' | 'colors' ...
      relations?: Record<string, any>; 
      [key: string]: any;
  }; 
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

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TEMPLATE_CREATOR = 'TEMPLATE_CREATOR',
  ACTIVE_SESSION = 'ACTIVE_SESSION',
  HISTORY_REVIEW = 'HISTORY_REVIEW',
}

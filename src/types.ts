
// --- Formula-based structure ---
export interface ScoreValue {
  parts: number[];
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
}

export type ScoringRule = 'HIGHEST_WINS' | 'LOWEST_WINS' | 'COOP' | 'COMPETITIVE_NO_SCORE' | 'COOP_NO_SCORE';

// [New Interface] Separate preferences from template definition
export interface TemplatePreference {
  templateId: string;
  lastPlayerCount?: number;
  defaultScoringRule?: ScoringRule;
  updatedAt?: number;
}

export interface GameTemplate {
  id: string;
  name: string;
  description?: string;
  columns: ScoreColumn[];
  createdAt: number;
  updatedAt?: number;    
  lastSyncedAt?: number; 
  isPinned?: boolean; 
  hasImage?: boolean;
  cloudImageId?: string; 
  globalVisuals?: GlobalVisuals;
  lastPlayerCount?: number; // 兼容舊資料，優先使用 TemplatePreference
  defaultScoringRule?: ScoringRule; // 兼容舊資料，優先使用 TemplatePreference
}

export interface GameSession {
  id: string;
  templateId: string;
  startTime: number;
  players: Player[];
  status: 'active' | 'completed';
  scoringRule?: ScoringRule; // 當次遊戲的勝利條件
}

// [New Interface] History Record
export interface HistoryRecord {
  id?: number; // IndexedDB auto-increment ID
  templateId: string; // 原始模板 ID (用於關聯)
  gameName: string; // 當時的遊戲名稱 (快照)
  startTime: number;
  endTime: number;
  players: Player[]; // 包含最終分數的玩家資料 (快照)
  winnerIds: string[]; // 贏家 ID 列表
  snapshotTemplate: GameTemplate; // [關鍵] 完整的模板快照 (含欄位、圖片ID等)
  location?: string; // 地點
  note?: string; // 筆記
}

// [New Interface] Generic Saved List Item (for Players, Locations, etc.)
export interface SavedListItem {
  id?: number;
  name: string;
  lastUsed: number;
  usageCount: number;
  meta?: any; // For future expansion (e.g. external links, coordinates)
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TEMPLATE_CREATOR = 'TEMPLATE_CREATOR',
  ACTIVE_SESSION = 'ACTIVE_SESSION',
  HISTORY_REVIEW = 'HISTORY_REVIEW',
}

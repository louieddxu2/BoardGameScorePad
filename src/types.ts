
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
    // c2, c3... for future use
  };
  f1?: MappingRule[]; // Definition for the f1() function
  // f2, f3... for future use
  
  // Automatic Calculation Config
  isAuto?: boolean; // New flag to identify auto-calculated columns
  variableMap?: Record<string, { id: string; name: string }>; // Maps "x1" -> { id: "uuid", name: "Column Name" }
  
  // Input & UI Helpers
  inputType: InputMethod; // 'keypad' | 'clicker' | 'auto' - NOW REQUIRED
  quickActions?: QuickAction[];
  
  // Formatting & Display
  unit?: string;
  subUnits?: [string, string]; // For product formula
  rounding?: RoundingMode;
  showPartsInGrid?: boolean; // For a1+next formula
  buttonGridColumns?: number; // For clicker/select UI
  
  // Display Control
  // New Property: Determines how the column is rendered
  // 'row' (default): Standard table row
  // 'overlay': Renders as a floating element on top of the PREVIOUS row
  // 'hidden': Not displayed in the grid
  displayMode?: 'row' | 'overlay' | 'hidden';
  
  // Visual Mapping (New)
  visuals?: ColumnVisuals;
  
  // Layout Configuration (New)
  contentLayout?: ContentLayout;

  // Meta
  isScoring: boolean;
}

// --- Shared types (mostly unchanged) ---
export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type InputMethod = 'keypad' | 'clicker' | 'auto';

export interface MappingRule {
  min?: number; // Inclusive
  max?: number | 'next'; // Inclusive. 'next' means (nextRule.min - 1)
  score: number; // Used for fixed score
  
  isLinear?: boolean; 
  unitScore?: number; // Explicit field for the slope (score per unit) in linear mode
  unit?: number; // Denominator for linear calc (Every X units)
}

export interface QuickAction {
  id: string;
  label: string;
  value: number;
  color?: string;
  isModifier?: boolean; // If true, adds to the last history item instead of creating a new one
}

// Player, GameTemplate, GameSession will now use the new ScoreColumn
export interface Player {
  id:string;
  name: string;
  color: string;
  scores: Record<string, ScoreValue>; 
  totalScore: number;
}

export interface GameTemplate {
  id: string;
  name: string;
  description?: string;
  columns: ScoreColumn[];
  createdAt: number;
  isPinned?: boolean; // For UI state, not persisted in template JSON
  
  // Visual Mapping (Modified)
  // baseImage is REMOVED to keep JSON small.
  // We use hasImage flag to prompt user to upload/scan image at runtime.
  hasImage?: boolean; 
  globalVisuals?: GlobalVisuals; // Textures for non-column areas (Player Header, Total Row)
}

export interface GameSession {
  id: string;
  templateId: string;
  startTime: number;
  players: Player[];
  status: 'active' | 'completed';
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TEMPLATE_CREATOR = 'TEMPLATE_CREATOR',
  ACTIVE_SESSION = 'ACTIVE_SESSION',
}

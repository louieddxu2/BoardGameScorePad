
// --- Formula-based structure ---
export interface ScoreValue {
  parts: number[];
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
  
  // Input & UI Helpers
  inputType: InputMethod; // 'keypad' | 'clicker' - NOW REQUIRED
  quickActions?: QuickAction[];
  
  // Formatting & Display
  unit?: string;
  subUnits?: [string, string]; // For product formula
  rounding?: RoundingMode;
  showPartsInGrid?: boolean; // For a1+next formula
  buttonGridColumns?: number; // For clicker/select UI
  
  // Meta
  isScoring: boolean;
}

// --- Shared types (mostly unchanged) ---
export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type InputMethod = 'keypad' | 'clicker';

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

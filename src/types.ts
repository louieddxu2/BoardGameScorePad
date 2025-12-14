
export type ColumnType = 'number' | 'text' | 'select' | 'boolean';
export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type CalculationType = 'standard' | 'product' | 'sum-parts';
export type InputMethod = 'keypad' | 'clicker';
// Deprecated: MappingStrategy is now handled per-rule via isLinear
export type MappingStrategy = 'zero' | 'linear'; 

export interface SelectOption {
  value: number;
  label: string;
}

export interface MappingRule {
  min?: number; // Inclusive
  max?: number | 'next'; // Inclusive. 'next' means (nextRule.min - 1)
  score: number; // If isLinear, this is the slope (score per unit)
  
  // New fields for per-rule linear logic
  isLinear?: boolean; 
  unit?: number; // Denominator for linear calc (Every X units)
}

export interface QuickAction {
  id: string;
  label: string;
  value: number;
  color?: string;
  isModifier?: boolean; // If true, adds to the last history item instead of creating a new one
}

export interface ScoreValue {
  value: number | string;
  history: string[]; // e.g. ["10", "+5", "-2"] or for sum-parts ["10", "5", "3"]
  factors?: [number | string, number | string]; // e.g. [5, 3] for 5 * 3
}

export interface ScoreColumn {
  id: string;
  name: string;
  color?: string;
  type: ColumnType;
  isScoring: boolean;
  weight?: number; // Multiplier
  options?: SelectOption[]; // For 'select' type
  mappingRules?: MappingRule[]; // For 'number' type with range lookups
  
  // Controls whether mapping rules are active. 
  // If undefined, defaults to true if mappingRules has content (backward compatibility).
  useMapping?: boolean; 

  // Legacy fields (kept for backward compatibility or migration)
  mappingStrategy?: MappingStrategy; 
  linearUnit?: number;  
  linearScore?: number; 
  mappingStep?: number; 

  unit?: string; // e.g., "隻", "棟"
  rounding?: RoundingMode; // Rounding logic
  quickButtons?: number[]; // Legacy: Custom quick add/sub button values
  
  // New fields for Button Input Mode
  inputType?: InputMethod;
  buttonGridColumns?: number; // Default 1
  quickActions?: QuickAction[];

  // New fields for Product Mode
  calculationType?: CalculationType; 
  subUnits?: [string, string]; // [Unit A name, Unit B name]
  
  // Display Options
  showPartsInGrid?: boolean; // For sum-parts: true = list parts, false = show total only
}

export interface Player {
  id: string;
  name: string;
  color: string;
  // scores value can be: number (legacy), ScoreValue (complex), boolean, or string
  scores: Record<string, any>; 
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


export type ColumnType = 'number' | 'text' | 'select' | 'boolean';
export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type CalculationType = 'standard' | 'product' | 'sum-parts';
export type InputMethod = 'keypad' | 'clicker';
// New: Strategy for handling values outside the defined mapping rules
// 'cap' is removed as it's equivalent to an infinite last rule.
export type MappingStrategy = 'zero' | 'linear'; 

export interface SelectOption {
  value: number;
  label: string;
}

export interface MappingRule {
  min?: number; // Inclusive
  max?: number | 'next'; // Inclusive. 'next' means (nextRule.min - 1)
  score: number;
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
  
  // New fields for Mapping Overflow Strategy
  mappingStrategy?: MappingStrategy; // Default 'linear'
  linearUnit?: number;  // "Per X units" (denominator)
  linearScore?: number; // "Add Y score" (numerator)

  // Legacy (can be removed or kept for migration safety if needed)
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

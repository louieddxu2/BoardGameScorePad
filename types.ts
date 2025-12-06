export type ColumnType = 'number' | 'text' | 'select' | 'boolean';
export type RoundingMode = 'none' | 'round' | 'floor' | 'ceil';
export type CalculationType = 'standard' | 'product';

export interface SelectOption {
  value: number;
  label: string;
}

export interface MappingRule {
  min?: number; // Inclusive
  max?: number; // Inclusive
  score: number;
}

export interface ScoreValue {
  value: number | string;
  history: string[]; // e.g. ["10", "+5", "-2"]
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
  unit?: string; // e.g., "隻", "棟"
  rounding?: RoundingMode; // Rounding logic
  quickButtons?: number[]; // Custom quick add/sub button values
  
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
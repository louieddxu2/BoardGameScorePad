/**
 * Game rules from the rules site, as the cloud's /api/rules routes forward them
 * (ScorepadApi in the board-game-helper project, docs/scorepad-integration.md).
 */
import type { FlowStage, RuleCategory } from '../../shared/ruleTypes';

/** What a BGG ID leads to: expansions and editions map to their base game. */
export interface RuleSummary {
  /** The base game whose rules to read. */
  ruleGameId: string;
  /** Published rules, reviewed or not. */
  publishedRuleCount: number;
  /** Changes when a published rule is added, edited, hidden, deleted or moved; not on reviews or resources. */
  ruleVersion: string;
}

export interface GameRule {
  id: string;
  statement: string;
  commonMistake?: string;
  details?: string;
  flowStage?: FlowStage;
  categories: RuleCategory[];
  playerCounts: number[];
  editionNotes: string[];
  sourceLinks: Array<{ label?: string; url: string }>;
  reviewStatus: 'not_required' | 'pending' | 'reviewed';
  importanceCount: number;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface GameRuleTag {
  id: string;
  name: string;
  categoryHints: RuleCategory[];
  detectionKeywords: string[];
}

export interface GameExternalResource {
  id: string;
  name: string;
  category: 'teaching' | 'help_card' | 'faq';
  url: string;
}

export interface GameRules {
  gameId: string;
  slug: string;
  displayName: string;
  englishName: string | null;
  ruleVersion: string;
  rules: GameRule[];
  tags: GameRuleTag[];
  externalResources: GameExternalResource[];
}

/** Dexie `ruleSummaries`: one row per BGG ID, also remembering "no rules" (summary null). */
export interface RuleSummaryRecord {
  bggId: string;
  /** Indexed so a newer rules read can update every BGG ID leading to the same base game. */
  ruleGameId: string | null;
  summary: RuleSummary | null;
  fetchedAt: number;
}

/** Dexie `ruleContents`: one row per base game, shared by its expansions and editions. */
export interface RuleContentRecord {
  gameId: string;
  rules: GameRules;
  fetchedAt: number;
}

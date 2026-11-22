import { useTranslation, type Language } from './index';
import type { FlowStage, RuleCategory } from '../shared/ruleTypes';
import { normalizePlayerCounts } from '../shared/ruleFilter';

/**
 * Labels for rules read from the rules site (getGameRules). The zh-TW wording follows the site:
 * categories match RULE_CATEGORY_LABELS in src/shared/ruleTypes.ts, flow stages its review page,
 * resource categories its external resources dialog. Rule content itself is only in Chinese.
 */
export const rulesTranslations = {
  'zh-TW': {
    category_all: "全部",
    category_teaching_setup_opening: "教學、設置、開局",
    category_action_effect_detail: "行動、效果、細節",
    category_flow_endgame_scoring: "流程、終局、計分",
    flow_setup: "設置",
    flow_round: "回合／輪次",
    flow_action: "行動",
    flow_end_scoring: "結束與計分",
    flow_edition_player_count: "版本／人數",
    flow_always: "全程適用",
    flow_uncategorized: "未分類",
    resource_teaching: "教學",
    resource_help_card: "幫助卡",
    resource_faq: "FAQ",
    review_pending: "未審核",
    review_reviewed: "審核完成",
    players_single: "{count}人",
    players_range: "{start}~{end}人",
    players_separator: "、",
  },
  'en': {
    category_all: "All",
    category_teaching_setup_opening: "Teaching, setup & opening",
    category_action_effect_detail: "Actions, effects & details",
    category_flow_endgame_scoring: "Flow, endgame & scoring",
    flow_setup: "Setup",
    flow_round: "Rounds",
    flow_action: "Actions",
    flow_end_scoring: "End & scoring",
    flow_edition_player_count: "Editions / player counts",
    flow_always: "Throughout",
    flow_uncategorized: "Uncategorized",
    resource_teaching: "Teaching",
    resource_help_card: "Help card",
    resource_faq: "FAQ",
    review_pending: "Not reviewed",
    review_reviewed: "Reviewed",
    players_single: "{count}P",
    players_range: "{start}–{end}P",
    players_separator: ", ",
  }
};

export type RulesTranslationKey = keyof typeof rulesTranslations['zh-TW'];
export type RuleResourceCategory = 'teaching' | 'help_card' | 'faq';
export type RuleReviewStatus = 'pending' | 'reviewed';

const fill = (text: string, params?: Record<string, string | number>): string =>
  params ? Object.entries(params).reduce((result, [k, v]) => result.replace(`{${k}}`, String(v)), text) : text;

export const translateRules = (language: Language, key: RulesTranslationKey, params?: Record<string, string | number>): string =>
  fill((rulesTranslations[language] || rulesTranslations['zh-TW'])[key], params);

export const ruleCategoryKey = (category: RuleCategory | 'all'): RulesTranslationKey => `category_${category}`;
export const flowStageKey = (stage: FlowStage): RulesTranslationKey => `flow_${stage}`;
export const resourceCategoryKey = (category: RuleResourceCategory): RulesTranslationKey => `resource_${category}`;
export const reviewStatusKey = (status: RuleReviewStatus): RulesTranslationKey => `review_${status}`;

/** Player counts as consecutive ranges, like the site's formatPlayerCounts but in the app's language. */
export const formatRulePlayerCounts = (language: Language, counts: number[]): string => {
  const ranges: Array<[number, number]> = [];
  for (const count of normalizePlayerCounts(counts)) {
    const current = ranges[ranges.length - 1];
    if (current && count === current[1] + 1) current[1] = count;
    else ranges.push([count, count]);
  }
  return ranges
    .map(([start, end]) => start === end
      ? translateRules(language, 'players_single', { count: start })
      : translateRules(language, 'players_range', { start, end }))
    .join(translateRules(language, 'players_separator'));
};

export const useRulesTranslation = () => {
  const { language } = useTranslation();
  const t = (key: RulesTranslationKey, params?: Record<string, string | number>): string => translateRules(language, key, params);
  const formatPlayerCounts = (counts: number[]): string => formatRulePlayerCounts(language, counts);
  return { t, formatPlayerCounts, language };
};

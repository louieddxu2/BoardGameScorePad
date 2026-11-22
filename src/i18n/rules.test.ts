import { describe, expect, it } from 'vitest';
import { FLOW_STAGES, RULE_CATEGORIES, RULE_CATEGORY_LABELS } from '../shared/ruleTypes';
import { formatPlayerCounts } from '../shared/ruleFilter';
import {
  flowStageKey,
  formatRulePlayerCounts,
  resourceCategoryKey,
  reviewStatusKey,
  ruleCategoryKey,
  rulesTranslations,
  translateRules,
} from './rules';

describe('rules translations', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(rulesTranslations.en).sort()).toEqual(Object.keys(rulesTranslations['zh-TW']).sort());
  });

  it('labels every category and flow stage the rules site sends', () => {
    const keys = Object.keys(rulesTranslations['zh-TW']);
    for (const category of [...RULE_CATEGORIES, 'all' as const]) expect(keys).toContain(ruleCategoryKey(category));
    for (const stage of FLOW_STAGES) expect(keys).toContain(flowStageKey(stage));
    for (const category of ['teaching', 'help_card', 'faq'] as const) expect(keys).toContain(resourceCategoryKey(category));
    for (const status of ['pending', 'reviewed'] as const) expect(keys).toContain(reviewStatusKey(status));
  });

  it('uses the site wording for categories in Chinese', () => {
    for (const category of RULE_CATEGORIES) {
      expect(translateRules('zh-TW', ruleCategoryKey(category))).toBe(RULE_CATEGORY_LABELS[category]);
    }
  });

  it('formats player counts like the site in Chinese and as ranges in English', () => {
    const counts = [5, 2, 3, 1, 3, 8, 9];
    expect(formatRulePlayerCounts('zh-TW', counts)).toBe(formatPlayerCounts(counts));
    expect(formatRulePlayerCounts('en', counts)).toBe('1–3P, 5P, 8P');
    expect(formatRulePlayerCounts('en', [])).toBe('');
  });
});

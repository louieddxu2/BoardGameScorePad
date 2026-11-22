import React, { useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { useRulesTranslation, ruleCategoryKey, resourceCategoryKey } from '../../../i18n/rules';
import { computeRuleFilter, type RuleFilterView } from '../../../shared/ruleFilter';
import { toFilterableRules } from '../rulesCache';
import type { GameRules } from '../types';
import RuleCard from './RuleCard';

const EMPTY_VIEW: RuleFilterView = { category: 'all', tags: [], playerCounts: [], editions: [] };

/**
 * A game's rules with the rules site's filters: categories that lead somewhere, keyword search
 * and tags, in the site's order. Player-count and edition filters are left to the site.
 */
const RulesBrowser: React.FC<{ rules: GameRules }> = ({ rules }) => {
  const { t } = useRulesTranslation();
  const [view, setView] = useState<RuleFilterView>(EMPTY_VIEW);
  const [query, setQuery] = useState('');
  const filterable = useMemo(() => toFilterableRules(rules), [rules]);
  const result = useMemo(() => computeRuleFilter(filterable, rules.tags, view, query), [filterable, rules.tags, view, query]);

  const toggleTag = (name: string) => setView((current) => ({
    ...current,
    tags: current.tags.includes(name) ? current.tags.filter((tag) => tag !== name) : [...current.tags, name],
  }));
  const categories = result.availableCategories;

  return (
    <div className="space-y-3">
      {categories.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category) => {
            const selected = result.selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => setView((current) => ({ ...current, category: selected ? 'all' : category }))}
                className={`rounded-xl border px-2 py-2 text-xs transition-colors ${selected ? 'border-brand-primary bg-brand-primary text-txt-on-color' : 'border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
              >
                {t(ruleCategoryKey(category))}
              </button>
            );
          })}
        </div>
      )}

      <label className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-alt px-3">
        <Search size={16} className="shrink-0 text-txt-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search_placeholder')}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-txt-primary outline-none placeholder:text-txt-muted"
        />
      </label>

      {(result.tagOptions.length > 0 || result.hasActiveFilters) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {result.hasActiveFilters && (
            <button
              type="button"
              onClick={() => setView((current) => ({ ...EMPTY_VIEW, category: current.category }))}
              aria-label={t('clear_filters')}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-status-danger text-txt-on-color"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          {result.tagOptions.map((option) => (
            <button
              key={option.name}
              type="button"
              aria-pressed={option.selected}
              onClick={() => toggleTag(option.name)}
              className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors ${option.selected ? 'border-txt-secondary bg-txt-secondary text-app-bg' : 'border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
            >
              #{option.name}
              {option.selected && <X size={12} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      {result.filteredRules.length === 0 ? (
        <p className="py-6 text-center text-sm text-txt-muted">{rules.rules.length ? t('no_match') : t('no_rules')}</p>
      ) : (
        <div className="space-y-2">
          {result.filteredRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      )}

      {rules.externalResources.length > 0 && (
        <section className="border-t border-surface-border pt-3">
          <h3 className="mb-1.5 text-xs text-txt-muted">{t('resources')}</h3>
          <ul className="space-y-1">
            {rules.externalResources.map((resource) => (
              <li key={resource.id}>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1 text-sm text-txt-secondary">
                  <span className="shrink-0 text-[11px] text-txt-muted">{t(resourceCategoryKey(resource.category))}</span>
                  <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                  <ExternalLink size={14} className="shrink-0 text-txt-muted" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default RulesBrowser;

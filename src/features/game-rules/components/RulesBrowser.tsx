import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import { useRulesTranslation, ruleCategoryKey, resourceCategoryKey } from '../../../i18n/rules';
import { computeRuleFilter, type RuleFilterView } from '../../../shared/ruleFilter';
import { toFilterableRules } from '../rulesCache';
import type { GameRules } from '../types';
import RuleCard from './RuleCard';

const EMPTY_VIEW: RuleFilterView = { category: 'all', tags: [], playerCounts: [], editions: [] };

/**
 * A category name such as 教學、設置、開局 shown as 教學·設置·開局. When the button is too narrow,
 * only the last part moves to a second line; the parts before it never break apart.
 */
const CategoryLabel: React.FC<{ label: string }> = ({ label }) => {
  const parts = label.split('、');
  if (parts.length < 2) return <>{label}</>;
  const last = parts.pop()!;
  return (
    <>
      <span className="whitespace-nowrap">{parts.join('·')}·</span>
      <wbr />
      <span className="whitespace-nowrap">{last}</span>
    </>
  );
};

/**
 * A game's rules with the rules site's filters: keyword search (with the game's external
 * resources beside it), categories that lead somewhere and tags, in the site's order.
 * Player-count and edition filters are left to the site.
 */
const RulesBrowser: React.FC<{ rules: GameRules }> = ({ rules }) => {
  const { t } = useRulesTranslation();
  const [view, setView] = useState<RuleFilterView>(EMPTY_VIEW);
  const [query, setQuery] = useState('');
  const [showResources, setShowResources] = useState(false);
  const filterable = useMemo(() => toFilterableRules(rules), [rules]);
  const result = useMemo(() => computeRuleFilter(filterable, rules.tags, view, query), [filterable, rules.tags, view, query]);

  const toggleTag = (name: string) => setView((current) => ({
    ...current,
    tags: current.tags.includes(name) ? current.tags.filter((tag) => tag !== name) : [...current.tags, name],
  }));
  const categories = result.availableCategories;

  const resources = rules.externalResources;

  return (
    <div className="space-y-3">
      {/* Search first; the game's external resources open from the button beside it. */}
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-surface-border bg-surface-alt px-3">
          <Search size={16} className="shrink-0 text-txt-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search_placeholder')}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-txt-primary outline-none placeholder:text-txt-muted"
          />
        </label>
        {resources.length > 0 && (
          <button
            type="button"
            aria-expanded={showResources}
            aria-controls="rules-resources"
            onClick={() => setShowResources((open) => !open)}
            className={`flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3 text-sm transition-colors ${showResources ? 'border-brand-primary text-brand-primary' : 'border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
          >
            {t('resources')}
            <span className="text-xs text-txt-muted">{resources.length}</span>
            <ChevronDown size={14} className={`transition-transform ${showResources ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {showResources && resources.length > 0 && (
        <ul id="rules-resources" className="space-y-0.5 rounded-xl border border-surface-border bg-surface-bg px-3 py-1.5">
          {resources.map((resource) => (
            <li key={resource.id}>
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1.5 text-sm text-txt-secondary">
                <span className="shrink-0 text-[11px] text-txt-muted">{t(resourceCategoryKey(resource.category))}</span>
                <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                <ExternalLink size={14} className="shrink-0 text-txt-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {categories.length > 1 && (
        // All categories on one row, sharing the full width.
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
          {categories.map((category) => {
            const selected = result.selectedCategory === category;
            const label = t(ruleCategoryKey(category));
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                onClick={() => setView((current) => ({ ...current, category: selected ? 'all' : category }))}
                className={`rounded-xl border px-1 py-2 text-xs leading-tight transition-colors ${selected ? 'border-brand-primary bg-brand-primary text-txt-on-color' : 'border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
              >
                <CategoryLabel label={label} />
              </button>
            );
          })}
        </div>
      )}

      {(result.tagOptions.length > 0 || result.hasActiveFilters) && (
        <div className="flex items-center gap-1.5">
          {result.hasActiveFilters && (
            <button
              type="button"
              onClick={() => setView((current) => ({ ...EMPTY_VIEW, category: current.category }))}
              aria-label={t('clear_filters')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-danger text-txt-on-color"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          {/* One line that scrolls sideways; swipes here scroll the tags instead of closing the drawer. */}
          <div data-drawer-no-swipe className="no-scrollbar -mr-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-3">
            {result.tagOptions.map((option) => (
              <button
                key={option.name}
                type="button"
                aria-pressed={option.selected}
                onClick={() => toggleTag(option.name)}
                className={`flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs transition-colors ${option.selected ? 'border-txt-secondary bg-txt-secondary text-app-bg' : 'border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
              >
                #{option.name}
                {option.selected && <X size={12} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {result.filteredRules.length === 0 ? (
        <p className="py-6 text-center text-sm text-txt-muted">{rules.rules.length ? t('no_match') : t('no_rules')}</p>
      ) : (
        <div className="space-y-2">
          {result.filteredRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      )}
    </div>
  );
};

export default RulesBrowser;

import React, { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useRulesTranslation } from '../../../i18n/rules';
import { getRuleEditions } from '../../../shared/ruleFilter';
import type { FilterableGameRule } from '../rulesCache';

/**
 * One rule as the rules site shows it on a game page: the rule and how it was played wrong,
 * expanding to the full text, details and sources. Community actions stay on the site.
 */
const RuleCard: React.FC<{ rule: FilterableGameRule }> = ({ rule }) => {
  const { t, formatPlayerCounts } = useRulesTranslation();
  const [expanded, setExpanded] = useState(false);
  const players = formatPlayerCounts(rule.playerCounts ?? []);
  const badges = [...rule.tags.map((tag) => `#${tag.name}`), ...(players ? [players] : []), ...getRuleEditions(rule)];
  const pending = rule.reviewStatus === 'pending';

  return (
    <article className={`rounded-xl border border-surface-border bg-surface-bg p-3 ${pending ? 'opacity-80' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={`${t(expanded ? 'collapse' : 'expand')}：${rule.statement}`}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {badges.map((badge) => (
            <span key={badge} className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[11px] text-txt-secondary">{badge}</span>
          ))}
          {pending && <span className="px-1 py-0.5 text-[11px] text-txt-muted">{t('review_pending')}</span>}
        </div>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-txt-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <p className={`mt-2 flex gap-2 text-sm leading-relaxed text-txt-primary ${expanded ? '' : 'line-clamp-2'}`}>
        <Check size={16} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
        <span className="whitespace-pre-line">{rule.statement}</span>
      </p>

      {rule.commonMistake && (
        <div className="mt-2 flex gap-2 rounded-r-lg border-l-2 border-status-danger bg-status-danger/10 px-2 py-1.5 text-sm leading-relaxed text-status-danger">
          <X size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className={expanded ? 'whitespace-pre-line' : 'line-clamp-2'}>
            {expanded && <span className="sr-only">{t('common_mistake')}：</span>}
            {rule.commonMistake}
          </span>
        </div>
      )}

      {expanded && rule.details && (
        <div className="mt-2 text-sm leading-relaxed text-txt-secondary">
          <div className="text-[11px] text-txt-muted">{t('details')}</div>
          <p className="whitespace-pre-line">{rule.details}</p>
        </div>
      )}

      {expanded && rule.sourceLinks.length > 0 && (
        <div className="mt-2 border-t border-surface-border pt-2 text-xs text-txt-muted">
          <div>{t('source')}</div>
          {rule.sourceLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block break-all text-txt-secondary underline">
              {link.label || link.url}
            </a>
          ))}
        </div>
      )}
    </article>
  );
};

export default RuleCard;

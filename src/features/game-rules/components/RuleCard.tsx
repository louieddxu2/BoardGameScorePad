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

  const toggle = () => setExpanded((value) => !value);
  // A tap anywhere on the card toggles it, except on a link or while selecting text.
  const onCardClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) return;
    if (window.getSelection?.()?.toString()) return;
    toggle();
  };

  return (
    <article
      onClick={onCardClick}
      className={`cursor-pointer rounded-xl border border-surface-border bg-surface-bg p-3 ${pending ? 'opacity-80' : ''}`}
    >
      {badges.length > 0 || pending ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span key={badge} className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[11px] text-txt-secondary">{badge}</span>
          ))}
          {pending && <span className="px-1 py-0.5 text-[11px] text-txt-muted">{t('review_pending')}</span>}
        </div>
      ) : null}

      {/* Icons in a left column: the rule's check, the mistake's cross, then the expand hint below them. */}
      <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2">
        {/* The correct rule leads; the mistake follows, smaller and quieter, so the eye lands on what is right. */}
        <Check size={18} strokeWidth={2.5} className="mt-0.5 text-brand-primary" aria-hidden="true" />
        <p className={`whitespace-pre-line text-[15px] font-semibold leading-snug text-txt-title ${expanded ? '' : 'line-clamp-3'}`}>{rule.statement}</p>

        {rule.commonMistake && (
          <>
            <X size={15} className="ml-px mt-[3px] text-status-danger/90" aria-hidden="true" />
            <p className={`mt-1.5 text-[13px] leading-relaxed text-status-danger/90 ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
              {expanded && <span className="sr-only">{t('common_mistake')}：</span>}
              {rule.commonMistake}
            </p>
          </>
        )}

        {/* Clicks bubble to the card, which toggles; the button is there for keyboards and screen readers. */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${t(expanded ? 'collapse' : 'expand')}：${rule.statement}`}
          className="mt-1.5 flex h-5 w-[18px] items-start justify-center text-txt-muted"
        >
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div className="mt-1.5 min-w-0">
          {expanded && rule.details && (
            <div className="text-sm leading-relaxed text-txt-secondary">
              <div className="text-[11px] text-txt-muted">{t('details')}</div>
              <p className="whitespace-pre-line">{rule.details}</p>
            </div>
          )}

          {expanded && rule.sourceLinks.length > 0 && (
            <div className={`${rule.details ? 'mt-2 border-t border-surface-border pt-2' : ''} text-xs text-txt-muted`}>
              <div>{t('source')}</div>
              {rule.sourceLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block break-all text-txt-secondary underline">
                  {link.label || link.url}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default RuleCard;

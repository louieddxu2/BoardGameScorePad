import React, { useState } from 'react';
import { Check, ChevronDown, MessageSquareText, X } from 'lucide-react';
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

  // The correct rule leads; the mistake follows, smaller and quieter, so the eye lands on what is right.
  const rows: { key: string; icon: React.ReactNode | null; content: React.ReactNode }[] = [{
    key: 'statement',
    icon: <Check size={18} strokeWidth={2.5} className="mt-0.5 text-brand-primary" aria-hidden="true" />,
    content: <p className={`whitespace-pre-line text-[15px] font-semibold leading-snug text-txt-title ${expanded ? '' : 'line-clamp-3'}`}>{rule.statement}</p>,
  }];
  if (rule.commonMistake) rows.push({
    key: 'mistake',
    icon: <X size={15} className="mt-[3px] text-status-danger/90" aria-hidden="true" />,
    content: (
      <p className={`text-[13px] leading-relaxed text-status-danger/90 ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
        {expanded && <span className="sr-only">{t('common_mistake')}：</span>}
        {rule.commonMistake}
      </p>
    ),
  });
  if (expanded && rule.details) rows.push({
    key: 'details',
    icon: <MessageSquareText size={15} className="mt-[3px] text-txt-muted" aria-hidden="true" />,
    content: (
      <p className="whitespace-pre-line text-sm leading-relaxed text-txt-secondary">
        <span className="sr-only">{t('details')}：</span>
        {rule.details}
      </p>
    ),
  });
  if (expanded && rule.sourceLinks.length > 0) rows.push({
    key: 'sources',
    // No icon of its own: the expand arrow sits beside the links.
    icon: null,
    content: (
      <div className="text-xs leading-relaxed">
        <span className="sr-only">{t('source')}</span>
        {rule.sourceLinks.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block break-all text-txt-secondary underline">
            {link.label || link.url}
          </a>
        ))}
      </div>
    ),
  });

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

      {/* Each row has its icon in a left column. The expand arrow sits at the bottom of the last
          row's cell, so a row tall enough holds it under its icon without growing. */}
      <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 gap-y-1.5">
        {rows.map((row, index) => (
          <React.Fragment key={row.key}>
            <div className="flex h-full flex-col items-center gap-1">
              {row.icon}
              {index === rows.length - 1 && (
                // Clicks bubble to the card, which toggles; the button is there for keyboards and screen readers.
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${t(expanded ? 'collapse' : 'expand')}：${rule.statement}`}
                  className="mt-auto flex h-5 w-[18px] items-center justify-center text-txt-muted"
                >
                  <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              )}
            </div>
            {row.content}
          </React.Fragment>
        ))}
      </div>
    </article>
  );
};

export default RuleCard;

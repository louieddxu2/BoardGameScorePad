import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useRulesTranslation } from '../../../i18n/rules';
import RulesSiteLogo from './RulesSiteLogo';

interface RulesEntryButtonProps {
  count: number;
  onClick: () => void;
}

/** The quiet pill beside the toolbox button that opens the rules drawer. */
const RulesEntryButton: React.FC<RulesEntryButtonProps> = ({ count, onClick }) => {
  const { t } = useRulesTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('entry_aria', { count })}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-surface-alt pl-2 pr-1.5 text-xs text-txt-primary transition-colors hover:bg-surface-hover active:scale-95"
    >
      <RulesSiteLogo size={16} />
      <span>{t('entry_label')}</span>
      <span className="text-txt-muted">{count}</span>
      <ChevronRight size={14} className="-ml-0.5 text-txt-muted" aria-hidden="true" />
    </button>
  );
};

export default RulesEntryButton;

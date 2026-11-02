import React, { useRef, useState } from 'react';
import { CalendarDays, ChevronUp } from 'lucide-react';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';
import { ALL_HISTORY_DATES, formatHistoryDateSelection, type HistoryDateFilter } from '../../utils/historyDateFilter';
import UpwardSelectMenu, { type UpwardSelectMenuAnchor } from '../shared/UpwardSelectMenu';
import HistoryDateFilterModal from './HistoryDateFilterModal';

interface Props { value: HistoryDateFilter; onChange: (value: HistoryDateFilter) => void; zIndex?: number }
const HistoryDateFilterControl: React.FC<Props> = ({ value, onChange, zIndex }) => {
  const { t } = useHistoryStatsTranslation();
  const [anchor, setAnchor] = useState<UpwardSelectMenuAnchor | null>(null);
  const [editing, setEditing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeEditor = () => { setEditing(false); buttonRef.current?.focus(); };
  const label = value.kind === 'all' ? t('stats_range_all') : value.kind === 'month' ? t('date_this_month') : formatHistoryDateSelection(value);
  return <>
    <button ref={buttonRef} type="button" title={label} aria-label={`${t('stats_date_filter_title')}: ${label}`}
      aria-haspopup="menu" aria-expanded={!!anchor}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const width = Math.min(Math.max(190, rect.width), window.innerWidth - 16);
        setAnchor({ bottom: window.innerHeight - rect.top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
      }} className="h-10 min-w-0 max-w-full bg-app-bg border border-surface-border rounded-lg px-2.5 flex items-center gap-1.5 text-txt-primary hover:border-txt-secondary">
      <CalendarDays size={14} className="text-txt-muted shrink-0" />
      <span className="text-sm font-bold whitespace-nowrap truncate">{label}</span>
      <ChevronUp size={12} className="shrink-0 text-txt-muted" />
    </button>
    {anchor && <UpwardSelectMenu anchor={anchor} listRef={menuRef} zIndex={zIndex}
      options={[
        { value: 'custom', label: value.kind === 'custom' ? `${t('date_custom')}: ${label}` : t('date_custom') },
        { value: 'month', label: t('date_this_month') },
        { value: 'all', label: t('stats_range_all') }
      ]} selectedValue={value.kind} onClose={() => setAnchor(null)} onSelect={kind => {
        setAnchor(null);
        if (kind === 'custom') setEditing(true);
        else onChange(kind === 'all' ? ALL_HISTORY_DATES : { kind: 'month' });
      }} />}
    {editing && <HistoryDateFilterModal value={value} onClose={closeEditor} onApply={next => {
      onChange(next); closeEditor();
    }} />}
  </>;
};
export default HistoryDateFilterControl;

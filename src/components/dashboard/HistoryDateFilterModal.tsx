import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';
import {
  applyHistoryDateDraft, changeHistoryDatePrecision, createHistoryDateDraft,
  historyDateDaysInMonth, resolveHistoryDateFilter,
  type HistoryDateFilter, type HistoryDateParts, type HistoryDatePrecision
} from '../../utils/historyDateFilter';
import { HistoryDateWheel } from './HistoryDateWheel';

interface Props { value: HistoryDateFilter; onApply: (value: HistoryDateFilter) => void; onClose: () => void }
const PRECISIONS: HistoryDatePrecision[] = ['year', 'month', 'day'];

const HistoryDateFilterModal: React.FC<Props> = ({ value, onApply, onClose }) => {
  const { t } = useHistoryStatsTranslation();
  const [draft, setDraft] = useState(() => createHistoryDateDraft(value));
  const { zIndex } = useModalBackHandler(true, onClose, 'history-date-filter');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    dialogRef.current?.focus();
    return () => { if (previousFocus.current?.isConnected) previousFocus.current.focus(); };
  }, []);
  const labels = { year: t('date_year'), month: t('date_month'), day: t('date_day') };
  const fieldLabels = {
    year: [t('date_year_field'), t('date_start_year'), t('date_end_year')],
    month: [t('date_month_field'), t('date_start_month'), t('date_end_month')],
    day: [t('date_day_field'), t('date_start_day'), t('date_end_day')]
  }[draft.precision];
  const valid = resolveHistoryDateFilter(applyHistoryDateDraft(draft)).valid;
  const setPart = (endpoint: 'start' | 'end', key: keyof HistoryDateParts, number: number) => {
    setDraft(current => {
      const parts = { ...current[endpoint], [key]: number };
      parts.day = Math.min(parts.day, historyDateDaysInMonth(parts.year, parts.month));
      return { ...current, [endpoint]: parts };
    });
  };
  const renderEndpoint = (endpoint: 'start' | 'end') => {
    const openKey = endpoint === 'start' ? 'startOpen' : 'endOpen';
    const open = draft.range && draft[openKey];
    const fieldLabel = fieldLabels[draft.range ? (endpoint === 'start' ? 1 : 2) : 0];
    return <section aria-label={fieldLabel} className="min-w-0">
      {draft.range && <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-txt-secondary">{t(endpoint === 'start' ? 'date_start' : 'date_end')}</h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={`${fieldLabel} ${t('date_unlimited')}`} aria-pressed={!!open}
            className={`min-h-11 px-2 text-xs rounded-lg ${open ? 'text-brand-primary bg-brand-primary/10' : 'text-txt-muted'}`}
            onClick={() => setDraft(current => ({ ...current, [openKey]: !current[openKey] }))}>{t('date_unlimited')}</button>
          {endpoint === 'end' && <button type="button" aria-label={t('date_remove_end')}
            className="w-11 h-11 flex items-center justify-center text-txt-muted"
            onClick={() => setDraft(current => ({ ...current, range: false, start: { ...(current.startOpen ? current.end : current.start) }, startOpen: false, endOpen: false }))}>
            <X size={15} />
          </button>}
        </div>
      </div>}
      <div className="grid grid-cols-3 gap-2">
        {PRECISIONS.map(key => {
          const included = PRECISIONS.indexOf(key) <= PRECISIONS.indexOf(draft.precision);
          return <HistoryDateWheel key={key} label={labels[key]} value={draft[endpoint][key]} min={1}
            max={key === 'year' ? 9999 : key === 'month' ? 12 : historyDateDaysInMonth(draft[endpoint].year, draft[endpoint].month)}
            disabled={!included || !!open}
            onActivate={included && open ? () => setDraft(current => ({ ...current, [openKey]: false })) : undefined}
            onChange={number => setPart(endpoint, key, number)} />;
        })}
      </div>
    </section>;
  };
  return createPortal(<div className="safe-area-screen-padding-6 fixed inset-0 bg-modal-backdrop/60 backdrop-blur-sm flex items-center justify-center p-4"
    style={{ zIndex }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('date_custom_title')} tabIndex={-1}
      className="w-full max-w-sm max-h-full flex flex-col rounded-2xl border border-surface-border bg-modal-bg shadow-ui-floating overflow-hidden"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="flex-none px-4 py-3 flex items-center justify-between border-b border-surface-border gap-2">
        <h2 className="text-base font-bold text-txt-title">{t('date_custom_title')}</h2>
        <button type="button" aria-label={t('date_cancel')} onClick={onClose} className="w-11 h-11 flex items-center justify-center text-txt-muted"><X size={20} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
        <div role="group" aria-label={t('date_precision')} className="grid grid-cols-3 gap-2">
          {PRECISIONS.map((precision, index) => <button key={precision} type="button" aria-pressed={draft.precision === precision}
            className={`min-w-0 min-h-11 px-3 rounded-lg border text-sm font-bold ${
              PRECISIONS.indexOf(draft.precision) >= index ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-surface-border text-txt-muted'
            }`} onClick={() => setDraft(current => changeHistoryDatePrecision(current, precision))}>{labels[precision]}</button>)}
        </div>
        {renderEndpoint('start')}
        {draft.range ? <div className="border-t border-surface-border pt-3">{renderEndpoint('end')}</div> :
          <button type="button" onClick={() => setDraft(current => ({ ...current, range: true, end: { ...current.start }, startOpen: false, endOpen: false }))}
            className="min-h-11 flex items-center gap-2 text-sm text-brand-primary"><Plus size={16} />{t('date_add_range')}</button>}
        {!valid && <p role="alert" className="text-sm text-status-danger">{t('date_invalid_range')}</p>}
      </div>
      <footer className="flex-none px-4 py-3 border-t border-surface-border bg-modal-bg-elevated flex justify-end">
        <button type="button" disabled={!valid} onClick={() => onApply(applyHistoryDateDraft(draft))}
          className="min-h-11 px-7 rounded-xl bg-brand-primary text-txt-on-color text-sm font-bold disabled:opacity-50">{t('date_apply')}</button>
      </footer>
    </div>
  </div>, document.body);
};
export default HistoryDateFilterModal;

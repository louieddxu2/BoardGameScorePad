
import React from 'react';
import { HistoryRecord } from '../../../types';
import { HistorySummary } from '../../../utils/extractDataSummaries';
import { Search, X } from 'lucide-react';
import HistoryDateFilterControl from '../HistoryDateFilterControl';
import { ALL_HISTORY_DATES, type HistoryDateFilter } from '../../../utils/historyDateFilter';
import { useHistoryStatsTranslation } from '../../../i18n/history_stats';
import HistoryList from '../HistoryList';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useIntegrationTranslation } from '../../../i18n/integration';

interface HistoryViewProps {
    records?: HistoryRecord[] | HistorySummary[];
    totalCount: number;
    searchQuery: string;
    dateFilter?: HistoryDateFilter;
    onDateFilterChange?: (value: HistoryDateFilter) => void;
    showDateFilter?: boolean;
    onDelete: (id: string) => void;
    onSelect: (record: HistoryRecord | HistorySummary) => void;
}

const TruncationFooter: React.FC<{ displayed: number, total: number, label: string }> = ({ displayed, total, label }) => {
    if (displayed >= total) return null;
    return (
        <div className="col-span-2 py-4 flex flex-col items-center justify-center text-txt-muted opacity-70">
            <div className="w-12 h-1 bg-surface-border/50 rounded-full mb-2"></div>
            <span className="text-[10px] font-mono">{label}</span>
        </div>
    );
};

export const HistoryView: React.FC<HistoryViewProps> = ({
    records,
    totalCount,
    searchQuery,
    dateFilter = ALL_HISTORY_DATES,
    onDateFilterChange,
    showDateFilter = true,
    onDelete,
    onSelect
}) => {
    const { t } = useDashboardTranslation();
    const { t: tIntegration } = useIntegrationTranslation();
    const { t: tHistory } = useHistoryStatsTranslation();

    return (
        <>
            {showDateFilter && dateFilter.kind !== 'all' && onDateFilterChange && (
                <div className="flex items-center gap-2">
                    <HistoryDateFilterControl value={dateFilter} onChange={onDateFilterChange} />
                    <button type="button" aria-label={tHistory('date_clear')} onClick={() => onDateFilterChange(ALL_HISTORY_DATES)}
                        className="w-11 h-11 flex items-center justify-center text-txt-muted shrink-0"><X size={16} /></button>
                </div>
            )}
            {searchQuery.trim().length > 0 && (
                <div className="flex justify-end items-center modal-bg-recessed/50 p-2 rounded-xl border border-surface-border animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 px-2">
                        <Search size={14} className="text-brand-primary" />
                        <span className="text-sm font-bold text-txt-secondary">
                            {t('dash_search_result_count', { count: totalCount || 0 })}
                        </span>
                        {totalCount > 100 && (
                            <span className="text-xs text-txt-muted border-l border-surface-border pl-2 ml-1">
                                {t('dash_search_result_limit')}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <HistoryList
                records={records}
                onDelete={onDelete}
                onSelect={onSelect}
            />

            <TruncationFooter displayed={records?.length || 0} total={totalCount || 0} label={tIntegration('history_truncation_label', { displayed: records?.length || 0, total: totalCount || 0 })} />
        </>
    );
};

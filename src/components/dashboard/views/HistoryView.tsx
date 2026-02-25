
import React from 'react';
import { HistoryRecord } from '../../../types';
import { HistorySummary } from '../../../utils/extractDataSummaries';
import { Search, FileJson, Database } from 'lucide-react';
import HistoryList from '../HistoryList';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useIntegrationTranslation } from '../../../i18n/integration';

interface HistoryViewProps {
    records?: HistoryRecord[] | HistorySummary[];
    totalCount: number;
    searchQuery: string;
    onDelete: (id: string) => void;
    onSelect: (record: HistoryRecord | HistorySummary) => void;
    onOpenBgStats: () => void;
    onOpenBggImport: () => void; // New Prop
}

const TruncationFooter: React.FC<{ displayed: number, total: number, label: string }> = ({ displayed, total, label }) => {
    if (displayed >= total) return null;
    return (
        <div className="col-span-2 py-4 flex flex-col items-center justify-center text-slate-500 opacity-70">
            <div className="w-12 h-1 bg-slate-700/50 rounded-full mb-2"></div>
            <span className="text-[10px] font-mono">{label}</span>
        </div>
    );
};

export const HistoryView: React.FC<HistoryViewProps> = ({
    records,
    totalCount,
    searchQuery,
    onDelete,
    onSelect,
    onOpenBgStats,
    onOpenBggImport
}) => {
    const { t } = useDashboardTranslation();
    const { t: tIntegration } = useIntegrationTranslation();

    return (
        <>
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-top-1">
                <button
                    onClick={onOpenBgStats}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold text-xs rounded-xl border border-slate-700/50 shadow-sm transition-colors whitespace-nowrap"
                >
                    <FileJson size={14} />
                    {tIntegration('btn_bgstats_open')}
                </button>

                <button
                    onClick={onOpenBggImport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold text-xs rounded-xl border border-slate-700/50 shadow-sm transition-colors whitespace-nowrap"
                >
                    <Database size={14} />
                    {tIntegration('btn_bgg_open')}
                </button>
            </div>

            {searchQuery.trim().length > 0 && (
                <div className="flex justify-end items-center bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 px-2">
                        <Search size={14} className="text-emerald-500" />
                        <span className="text-sm font-bold text-slate-300">
                            {t('dash_search_result_count', { count: totalCount || 0 })}
                        </span>
                        {totalCount > 100 && (
                            <span className="text-xs text-slate-500 border-l border-slate-600 pl-2 ml-1">
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

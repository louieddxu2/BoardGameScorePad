
import React from 'react';
import { HistoryRecord } from '../../types';
import { HistorySummary } from '../../utils/extractDataSummaries';
import HistoryCard from './parts/HistoryCard';
import { History as HistoryIcon } from 'lucide-react';
import { useDashboardTranslation } from '../../i18n/dashboard';

interface HistoryListProps {
    records: HistoryRecord[] | HistorySummary[] | undefined;
    onDelete: (id: string) => void; // [Change] string ID
    onSelect: (record: HistoryRecord | HistorySummary) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ records, onDelete, onSelect }) => {
    const { t } = useDashboardTranslation();
    // Logic updated: records passed here are already filtered by the DB hook based on search query.
    // We render whatever we get.

    if (!records || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700">
                    <HistoryIcon size={40} className="opacity-50" />
                </div>
                <p className="text-sm font-bold">{t('dash_no_records')}</p>
                <p className="text-xs max-w-[200px] text-center opacity-70">{t('dash_no_records_hint')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {records.map(record => (
                <HistoryCard
                    key={record.id}
                    record={record}
                    onDelete={onDelete}
                    onClick={() => onSelect(record)}
                />
            ))}
        </div>
    );
};

export default HistoryList;

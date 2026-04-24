
import { HistoryRecord } from '../../../types';
import { HistorySummary } from '../../../utils/extractDataSummaries';
import { Crown, Calendar, Trash2, MapPin } from 'lucide-react';
import { ContrastText } from '../../shared/ContrastText';
import { useCommonTranslation } from '../../../i18n/common';

interface HistoryCardProps {
    record: HistoryRecord | HistorySummary;
    onDelete: (id: string) => void; // [Change] string ID
    onClick: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ record, onDelete, onClick }) => {
    const { language } = useCommonTranslation();
    const date = new Date(record.endTime);
    const dateStr = date.toLocaleDateString(language, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false });

    return (
        <div
            onClick={onClick}
            className="bg-surface-bg rounded-xl border border-surface-border shadow-md p-4 relative group hover:bg-surface-hover hover:border-surface-border-hover transition-all duration-200 w-full cursor-pointer"
        >
            {/* Header: Date & Title */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1.5 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-xs text-txt-muted font-mono">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            <span>{dateStr}</span>
                            <span className="w-1 h-1 rounded-full bg-surface-border"></span>
                            <span>{timeStr}</span>
                        </div>
                        {record.location && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-status-info/10 border border-status-info/30 text-status-info shadow-sm">
                                <MapPin size={10} />
                                <span className="truncate max-w-[100px] sm:max-w-[150px]">{record.location}</span>
                            </div>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-txt-primary leading-tight truncate pr-2 group-hover:text-txt-card-hover transition-colors">{record.gameName}</h3>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); if (record.id) onDelete(record.id); }}
                    className="p-2 text-txt-muted hover:text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors -mr-2 -mt-2 shrink-0"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                {record.players.map(p => {
                    const isWinner = (p.linkedPlayerId && record.winnerIds.includes(p.linkedPlayerId)) || record.winnerIds.includes(p.id);

                    const isTransparent = p.color === 'transparent';

                    return (
                        <div key={p.id} className={`flex items-center justify-between text-sm ${isWinner ? 'bg-status-warning/10 -mx-2 px-2 py-1 rounded-lg border border-status-warning/30 shadow-sm' : ''}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                {isWinner && <Crown size={14} className="text-status-warning shrink-0" fill="currentColor" />}
                                <ContrastText
                                    className={`truncate font-medium ${isWinner ? 'text-status-warning brightness-125' : 'text-txt-secondary'}`}
                                    color={isWinner ? 'rgb(var(--c-status-warning))' : (isTransparent ? 'rgb(var(--c-txt-secondary))' : p.color)}
                                >
                                    {p.name}
                                </ContrastText>
                            </div>
                            <span className={`font-mono font-bold ${isWinner ? 'text-status-warning text-base' : 'text-txt-muted'}`}>
                                {p.totalScore}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HistoryCard;

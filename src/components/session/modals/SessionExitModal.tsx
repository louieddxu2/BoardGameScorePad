
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, MapPin, ChevronDown } from 'lucide-react';
import { useGameFlowTranslation } from '../../../i18n/game_flow';
import { useCommonTranslation } from '../../../i18n/common';
import { useConfirm } from '../../../hooks/useConfirm';
import { SavedListItem } from '../../../types';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

interface SessionExitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveActive: (location: string) => void;
    onSaveHistory: (location?: string) => void;
    onDiscard?: () => void;
    savedLocations?: SavedListItem[]; // Renamed from locationHistory
    initialLocation?: string;
}

const SessionExitModal: React.FC<SessionExitModalProps> = ({
    isOpen,
    onClose,
    onSaveActive,
    onSaveHistory,
    onDiscard,
    savedLocations = [], // Renamed
    initialLocation = ''
}) => {
    const { t } = useGameFlowTranslation(); // Use new hook
    const { t: tCommon } = useCommonTranslation();
    const { confirm } = useConfirm();
    const { zIndex } = useModalBackHandler(isOpen, onClose, 'session-exit');
    const [location, setLocation] = useState(initialLocation);
    const [showLocationMenu, setShowLocationMenu] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    // Sync state when modal opens or initialLocation changes
    useEffect(() => {
        if (isOpen) {
            setLocation(initialLocation || '');
        }
    }, [isOpen, initialLocation]);

    // Sorting: Oldest to Newest (Ascending)
    const sortedLocations = useMemo(() => {
        return [...savedLocations].sort((a, b) => a.lastUsed - b.lastUsed);
    }, [savedLocations]);

    // Auto-scroll to bottom when menu opens
    useEffect(() => {
        if (showLocationMenu && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [showLocationMenu]);

    if (!isOpen) return null;

    const handleDiscardClick = async () => {
        const isConfirmed = await confirm({
            title: t('confirm_discard_title'),
            message: t('confirm_discard_msg'),
            confirmText: tCommon('delete'),
            isDangerous: true
        });

        if (isConfirmed) {
            if (onDiscard) onDiscard();
            onClose();
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-modal-backdrop/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
                style={{ zIndex }}
                onClick={onClose}
            >
                <div
                    className="bg-modal-bg rounded-2xl border border-modal-border shadow-2xl p-5 w-full max-w-sm flex flex-col gap-5 relative"
                    onClick={(e) => { e.stopPropagation(); setShowLocationMenu(false); }}
                >
                    {/* 1. Header (Navigation Style) */}
                    <div className="flex items-center justify-between">
                        {onDiscard ? (
                            <button
                                onClick={handleDiscardClick}
                                className="text-status-danger hover:opacity-80 text-sm font-bold px-2 py-1 -ml-2 rounded transition-colors"
                            >
                                {t('exit_btn_discard')}
                            </button>
                        ) : <div className="w-10"></div>}

                        <div className="flex flex-col items-center">
                            <h3 className="text-lg font-bold text-txt-title leading-tight">{t('exit_title')}</h3>
                            <span className="text-[10px] text-txt-secondary">{t('exit_msg')}</span>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-txt-muted hover:text-txt-title p-2 -mr-2 rounded-full hover:bg-modal-bg-elevated transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* 2. Body (Location Input) */}
                    <div className="relative z-10">
                        <div className="flex items-center bg-modal-bg-elevated/50 border border-surface-border rounded-xl overflow-hidden focus-within:border-brand-secondary focus-within:ring-1 focus-within:ring-brand-secondary/50 transition-all">
                            <div className="pl-3 pr-2 text-brand-secondary shrink-0">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={t('exit_location_ph')}
                                className="flex-1 bg-transparent h-12 text-txt-title placeholder-txt-muted text-sm outline-none font-bold min-w-0"
                            />
                            {/* Dropdown Trigger */}
                            {sortedLocations.length > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowLocationMenu(!showLocationMenu); }}
                                    className="h-12 px-3 border-l border-surface-border text-txt-secondary hover:text-txt-title hover:bg-surface-hover/50 transition-colors shrink-0"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown Menu (Upwards) */}
                        {showLocationMenu && (
                            <div
                                ref={listRef}
                                className="absolute bottom-full left-0 right-0 mb-2 bg-modal-bg-elevated border border-surface-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto no-scrollbar z-20 animate-in fade-in slide-in-from-bottom-1"
                            >
                                {sortedLocations.map(loc => (
                                    <button
                                        key={loc.id}
                                        onClick={() => { setLocation(loc.name); setShowLocationMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm text-txt-tertiary hover:bg-surface-hover/50 hover:text-txt-title border-b border-surface-border/50 last:border-0 truncate font-medium"
                                    >
                                        {loc.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 3. Footer (Action Buttons) */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onSaveActive(location)}
                            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl bg-modal-bg-elevated border border-surface-border hover:bg-surface-hover text-txt-tertiary transition-colors active:scale-95"
                        >
                            <span className="text-sm font-bold">{t('exit_btn_draft')}</span>
                            <span className="text-[10px] text-txt-muted">{t('exit_btn_draft_sub')}</span>
                        </button>

                        <button
                            onClick={() => onSaveHistory(location)}
                            className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl bg-brand-primary-deep hover:bg-brand-primary text-white shadow-lg transition-transform active:scale-95"
                        >
                            <span className="text-sm font-bold">{t('exit_btn_finish')}</span>
                            <span className="text-[10px] text-white/60 font-medium">{t('exit_btn_finish_sub')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SessionExitModal;

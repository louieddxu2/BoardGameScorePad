
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Save, LogOut, X, MapPin, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import ConfirmationModal from '../../shared/ConfirmationModal';
import { SavedListItem } from '../../../types';

interface SessionExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveActive: (location: string) => void; // Updated to accept location
  onSaveHistory: (location?: string) => void; 
  onDiscard?: () => void;
  locationHistory?: SavedListItem[]; 
  initialLocation?: string; // New prop
}

const SessionExitModal: React.FC<SessionExitModalProps> = ({
  isOpen,
  onClose,
  onSaveActive,
  onSaveHistory,
  onDiscard,
  locationHistory = [],
  initialLocation = ''
}) => {
  const { t } = useTranslation();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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
  // This places the most recently used items at the END of the array.
  // Combined with "bottom-full", the last item will be visually at the bottom (closest to input).
  const sortedLocations = useMemo(() => {
      return [...locationHistory].sort((a, b) => a.lastUsed - b.lastUsed);
  }, [locationHistory]);

  // Auto-scroll to bottom when menu opens to show most recent items
  useEffect(() => {
      if (showLocationMenu && listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
      }
  }, [showLocationMenu]);

  if (!isOpen) return null;

  return (
    <>
        <ConfirmationModal 
            isOpen={showDiscardConfirm}
            title={t('confirm_discard_title')}
            message={t('confirm_discard_msg')}
            confirmText={t('delete')}
            cancelText={t('cancel')}
            isDangerous={true}
            zIndexClass="z-[70]"
            onCancel={() => setShowDiscardConfirm(false)}
            onConfirm={() => {
                if (onDiscard) onDiscard();
                setShowDiscardConfirm(false);
                onClose();
            }}
        />

        <div 
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
            onClick={onClose}
        >
        <div 
            // Removed overflow-hidden to allow dropdown to expand outside
            className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-5 w-full max-w-sm flex flex-col gap-5 relative"
            onClick={(e) => { e.stopPropagation(); setShowLocationMenu(false); }}
        >
            {/* 1. Header (Navigation Style) */}
            <div className="flex items-center justify-between">
                {onDiscard ? (
                    <button 
                        onClick={() => setShowDiscardConfirm(true)}
                        className="text-red-400 hover:text-red-300 text-sm font-bold px-2 py-1 -ml-2 rounded transition-colors"
                    >
                        {t('session_discard')}
                    </button>
                ) : <div className="w-10"></div>}

                <div className="flex flex-col items-center">
                    <h3 className="text-lg font-bold text-white leading-tight">{t('session_exit_title')}</h3>
                    <span className="text-[10px] text-slate-400">{t('session_exit_msg')}</span>
                </div>

                <button 
                    onClick={onClose}
                    className="text-slate-500 hover:text-white p-2 -mr-2 rounded-full hover:bg-slate-800 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* 2. Body (Location Input) */}
            <div className="relative z-10">
                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
                    <div className="pl-3 pr-2 text-indigo-400 shrink-0">
                        <MapPin size={18} />
                    </div>
                    <input 
                        type="text" 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="在哪裡進行遊戲？" 
                        className="flex-1 bg-transparent h-12 text-white placeholder-slate-500 text-sm outline-none font-bold min-w-0"
                    />
                    {/* Dropdown Trigger */}
                    {sortedLocations.length > 0 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowLocationMenu(!showLocationMenu); }}
                            className="h-12 px-3 border-l border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                        >
                            <ChevronDown size={16} />
                        </button>
                    )}
                </div>

                {/* Dropdown Menu (Upwards) */}
                {showLocationMenu && (
                    <div 
                        ref={listRef}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto no-scrollbar z-20 animate-in fade-in slide-in-from-bottom-1"
                    >
                        {sortedLocations.map(loc => (
                            <button
                                key={loc.id}
                                onClick={() => { setLocation(loc.name); setShowLocationMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white border-b border-slate-700/50 last:border-0 truncate font-medium"
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
                    className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
                >
                    <span className="text-sm font-bold">暫存遊戲</span>
                    <span className="text-[10px] text-slate-500">(稍後再玩)</span>
                </button>

                <button
                    onClick={() => onSaveHistory(location)}
                    className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 transition-transform active:scale-95"
                >
                    <span className="text-sm font-bold">結束遊戲</span>
                    <span className="text-[10px] text-emerald-100/60 font-medium">(儲存紀錄)</span>
                </button>
            </div>
        </div>
        </div>
    </>
  );
};

export default SessionExitModal;

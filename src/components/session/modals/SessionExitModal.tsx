
import React, { useState } from 'react';
import { Save, LogOut, X } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import ConfirmationModal from '../../shared/ConfirmationModal';

interface SessionExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveActive: () => void;
  onSaveHistory: () => void;
  onDiscard?: () => void; // New prop
}

const SessionExitModal: React.FC<SessionExitModalProps> = ({
  isOpen,
  onClose,
  onSaveActive,
  onSaveHistory,
  onDiscard
}) => {
  const { t } = useTranslation();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
            className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 w-full max-w-sm relative"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Top Left: Discard Button (Red Text with Border) */}
            {onDiscard && (
                <button 
                    onClick={() => setShowDiscardConfirm(true)}
                    className="absolute top-3 left-3 text-red-400 border border-red-500/30 hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors text-xs font-bold"
                >
                    {t('session_discard')}
                </button>
            )}

            {/* Top Right: Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-3 right-3 text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            >
                <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center gap-3 mb-6 mt-2">
            <h3 className="text-xl font-bold text-white">{t('session_exit_title')}</h3>
            <p className="text-slate-400 text-sm whitespace-pre-wrap">{t('session_exit_msg')}</p>
            </div>

            <div className="flex flex-col gap-3">
            {/* 暫存放在上方 */}
            <button
                onClick={onSaveActive}
                className="w-full py-4 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-3 transition-colors group"
            >
                <LogOut size={20} className="text-sky-400 group-hover:text-sky-300" />
                <span>{t('session_btn_draft')}</span>
            </button>

            {/* 結算放在下方 */}
            <button
                onClick={onSaveHistory}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-3 transition-transform active:scale-95"
            >
                <Save size={20} />
                <span>{t('session_btn_finish')}</span>
            </button>
            </div>
        </div>
        </div>
    </>
  );
};

export default SessionExitModal;

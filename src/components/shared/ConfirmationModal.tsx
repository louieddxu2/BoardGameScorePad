
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  zIndexClass?: string; // New prop for custom z-index
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDangerous = false,
  zIndexClass = "z-[110]", // [Fixed] Bumped from z-[60] to z-[110]
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Use translation defaults if props are not provided
  const effectiveConfirmText = confirmText || t('confirm');
  const effectiveCancelText = cancelText || t('cancel');

  return (
    <div 
      className={`fixed inset-0 ${zIndexClass} bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200`}
      onClick={(e) => {
        // Allow clicking backdrop to cancel
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div 
        className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()} // Prevent click propagation from content
      >
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          {isDangerous && (
            <div className="bg-red-900/20 p-3 rounded-full text-red-500">
              <AlertTriangle size={32} />
            </div>
          )}
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="text-slate-400 text-sm whitespace-pre-wrap">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
          >
            {effectiveCancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-colors ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50' 
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
            }`}
          >
            {effectiveConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

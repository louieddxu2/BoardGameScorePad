
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCommonTranslation } from '../../i18n/common';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  hideCancel?: boolean;
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
  hideCancel = false,
  zIndexClass = "z-[110]", // [Fixed] Bumped from z-[60] to z-[110]
}) => {
  const { t } = useCommonTranslation();

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
        className="modal-container p-6 relative"
        onClick={(e) => e.stopPropagation()} // Prevent click propagation from content
      >
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          {isDangerous && (
            <div className="bg-status-danger/20 p-3 rounded-full text-status-danger">
              <AlertTriangle size={32} />
            </div>
          )}
          <h3 className="text-xl font-bold text-txt-primary">{title}</h3>
          <p className="text-txt-secondary text-sm whitespace-pre-wrap">{message}</p>
        </div>
        <div className="flex gap-3">
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="btn-modal-secondary"
            >
              {effectiveCancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 ${isDangerous
                ? 'bg-status-danger hover:brightness-110'
                : 'bg-brand-primary hover:brightness-110'
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

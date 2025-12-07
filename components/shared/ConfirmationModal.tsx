
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "確定",
  cancelText = "取消",
  onConfirm,
  onCancel,
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-6 w-full max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          {isDangerous && (
            <div className="bg-red-900/20 p-3 rounded-full text-red-500">
              <AlertTriangle size={32} />
            </div>
          )}
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="text-slate-400 text-sm">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-colors ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50' 
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;


import React, { useState, useEffect } from 'react';
import { ToastMessage } from '../../hooks/useToast';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface ToastProps extends ToastMessage {
  onDismiss: () => void;
}

const ICONS = {
  success: <CheckCircle className="text-emerald-400" size={20} />,
  warning: <AlertTriangle className="text-yellow-400" size={20} />,
  error: <XCircle className="text-red-400" size={20} />,
  info: <Info className="text-sky-400" size={20} />,
};

const BORDER_COLORS = {
  success: 'border-emerald-500/50',
  warning: 'border-yellow-500/50',
  error: 'border-red-500/50',
  info: 'border-sky-500/50',
};

// Updated default duration to 3000ms
const Toast: React.FC<ToastProps> = ({ id, title, message, type = 'info', duration = 3000, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Match animation duration
  };

  const icon = ICONS[type];
  const borderColor = BORDER_COLORS[type];

  const animationClasses = isExiting ? 'toast-exit-active' : 'toast-enter-active';

  return (
    <div
      className={`w-full max-w-sm bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border ${borderColor} flex items-start p-3 gap-3 ${animationClasses} pointer-events-auto`}
      role="alert"
      aria-live="assertive"
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h3 className="text-sm font-bold text-white mb-0.5 break-words">{title}</h3>}
        <p className="text-sm text-slate-300 break-words whitespace-pre-wrap">{message}</p>
      </div>
      <button onClick={handleDismiss} className="p-1 -m-1 text-slate-500 hover:text-white shrink-0">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;

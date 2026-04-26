
import React, { useState, useEffect } from 'react';
import { ToastMessage } from '../../hooks/useToast';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface ToastProps extends ToastMessage {
  onDismiss: () => void;
}

const ICONS = {
  success: <CheckCircle className="text-status-success" size={20} />,
  warning: <AlertTriangle className="text-status-warning" size={20} />,
  error: <XCircle className="text-status-danger" size={20} />,
  info: <Info className="text-status-info" size={20} />,
};

const BORDER_COLORS = {
  success: 'border-status-success/50',
  warning: 'border-status-warning/50',
  error: 'border-status-danger/50',
  info: 'border-status-info/50',
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
      className={`w-full max-w-sm bg-modal-bg-elevated/80 backdrop-blur-md rounded-xl shadow-2xl border ${borderColor} flex items-start p-3 gap-3 ${animationClasses} pointer-events-auto`}
      role="alert"
      aria-live="assertive"
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h3 className="text-sm font-bold text-txt-title mb-0.5 break-words">{title}</h3>}
        <p className="text-sm text-txt-tertiary break-words whitespace-pre-wrap">{message}</p>
      </div>
      <button onClick={handleDismiss} className="p-1 -m-1 text-txt-muted hover:text-txt-title shrink-0">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;

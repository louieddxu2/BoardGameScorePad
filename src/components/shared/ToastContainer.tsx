import React from 'react';
import { ToastMessage } from '../../hooks/useToast';
import Toast from './Toast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 sm:p-0 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

export default ToastContainer;

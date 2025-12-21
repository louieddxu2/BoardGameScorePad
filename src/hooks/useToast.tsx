import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import ToastContainer from '../components/shared/ToastContainer';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  showToast: (options: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((options: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast: ToastMessage = { id, type: 'info', ...options };
    // 將新 toast 放在陣列最前面，使其顯示在最上方
    setToasts(prevToasts => [newToast, ...prevToasts]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

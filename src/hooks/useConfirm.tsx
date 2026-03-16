
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { useModalBackHandler } from './useModalBackHandler';

/**
 * [Precautions for Global Confirmation Service]
 * 1. PWA Back Button: Must use `useModalBackHandler` to hook into browser history.
 *    Failure to do so will cause the app to close or history to break on mobile back press.
 * 2. Z-Index Layering: Must use `z-[110]` to appear ABOVE the Inspector (`z-[100]`).
 * 3. Atomic Updates: Ensure only one confirmation can be active at a time to prevent stack issues.
 */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface ConfirmationContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (modalState) {
      modalState.resolve(result);
      setModalState(null);
    }
  }, [modalState]);

  // Hook into mobile back button behavior
  // Important: This is the core requirement for PWA "precautions" mentioned by user
  useModalBackHandler(!!modalState?.isOpen, () => handleClose(false), 'global-confirm');

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <ConfirmationModal
          isOpen={modalState.isOpen}
          title={modalState.options.title}
          message={modalState.options.message}
          confirmText={modalState.options.confirmText}
          cancelText={modalState.options.cancelText}
          isDangerous={modalState.options.isDangerous}
          zIndexClass="z-[110]" // [Precaution] Must be above Inspector (z-100)
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmationContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmationProvider');
  }
  return context;
};

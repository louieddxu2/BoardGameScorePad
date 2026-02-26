
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { ToastProvider } from './hooks/useToast';
import { LanguageProvider } from './i18n'; // Import i18n provider
import './index.css';

// [Requirement] Force reset the cloud connection preference on App boot / Refresh.
// This ensures that every time the user opens or refreshes the page, the auto-connect is disabled.
localStorage.setItem('google_drive_auto_connect', 'false');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </LanguageProvider>
  </React.StrictMode>
);

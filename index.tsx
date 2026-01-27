
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './src/components/shared/ErrorBoundary';
import { ToastProvider } from './src/hooks/useToast';
import { LanguageProvider } from './src/i18n'; // Import i18n provider
import './src/index.css';

// [Requirement] Force reset the cloud connection preference on App boot / Refresh.
// This ensures that every time the user opens or refreshes the page, the auto-connect is disabled.
localStorage.setItem('google_drive_auto_connect', 'false');

// [Requirement] Request Persistent Storage
// This tells the browser to treat this site's storage as "persistent" and not clear it
// automatically under storage pressure.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((granted) => {
    if (granted) {
      console.log("Storage persistence granted.");
    } else {
      console.log("Storage persistence denied (or not promptable).");
    }
  }).catch(err => {
    console.warn("Storage persistence request failed:", err);
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

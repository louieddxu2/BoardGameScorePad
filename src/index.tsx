import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // 載入 Tailwind 編譯後的 CSS
import '@fontsource/inter/400.css'; // 載入 Inter 字體 (Regular)
import '@fontsource/inter/700.css'; // 載入 Inter 字體 (Bold)
import '@fontsource/inter/900.css'; // 載入 Inter 字體 (Black)

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
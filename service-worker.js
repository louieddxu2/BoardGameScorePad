const CACHE_NAME = 'boardgame-scorepad-v1';

// 定義需要快取的資源列表
// 包含 CDN 連結與專案原始碼檔案
const CACHE_ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './App.tsx',
  './types.ts',
  './metadata.json',
  './utils/scoring.ts',
  './services/geminiService.ts',
  './components/TemplateEditor.tsx',
  './components/SessionView.tsx',
  './components/NumericKeypad.tsx',
  './components/session/ScoreCell.tsx',
  './components/shared/ConfirmationModal.tsx',
  './components/shared/ColumnConfigEditor.tsx',
  './src/constants.ts',
  // CDN 外部資源 (必須快取才能離線使用)
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.1',
  'https://aistudiocdn.com/react-dom@^19.2.1/',
  'https://aistudiocdn.com/@google/genai@^1.31.0',
  'https://aistudiocdn.com/lucide-react@^0.556.0',
  'https://aistudiocdn.com/html2canvas@^1.4.1',
  'https://aistudiocdn.com/vite@^7.2.6',
  'https://aistudiocdn.com/@vitejs/plugin-react@^5.1.1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        // 使用 addAll 快取所有列表中的檔案
        // 注意：如果任何一個檔案下載失敗，整個快取就會失敗
        return cache.addAll(CACHE_ASSETS);
      })
      .catch(err => console.error('Service Worker: Cache failed', err))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果快取中有資源，直接回傳快取
        if (response) {
          return response;
        }
        // 否則從網路獲取
        return fetch(event.request).catch(() => {
          // 離線且無快取時的處理 (可選)
          // console.log('Offline and no cache match');
        });
      })
  );
});

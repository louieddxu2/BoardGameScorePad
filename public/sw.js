
const CACHE_NAME = 'boardgame-scorepad-v2.1.0-release';

// 核心靜態資源 (使用絕對路徑以確保可靠性)
// 移除了 manifest.json，因為 Vite 會在 build 時對其檔名進行 hash 處理，
// 導致此處的靜態路徑失效而安裝失敗。
// manifest 將會在瀏覽器請求時被 fetch 事件動態快取。
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制讓新的 SW 立即接管
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .catch(err => console.error('SW Install Error:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只處理 http/https 請求 (忽略 chrome-extension:// 等)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 1. 如果快取有，直接回傳
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. 如果快取沒有，發送網路請求
        // [DEBUG] 新增日誌：顯示哪些請求穿透了快取
        console.log(`[SW] Network request for: ${event.request.url}`);
        return fetch(event.request).then((networkResponse) => {
          // 檢查回應是否有效 (Status 200)
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
            // [DEBUG] 新增日誌：捕捉到無效的回應
            console.warn(`[SW] Invalid network response for ${event.request.url}. Status: ${networkResponse.status}`);
            return networkResponse;
          }

          // 3. 動態快取：複製一份回應存入快取
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch((err) => {
          // [DEBUG] 新增日誌：這就是您要找的 4xx 錯誤來源！
          console.error(`[SW] Fetch failed for: ${event.request.url}`, err);
          // 拋出錯誤以觸發瀏覽器的標準錯誤流程
          throw err;
        });
      })
  );
});

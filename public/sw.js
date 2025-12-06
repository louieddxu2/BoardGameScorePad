const CACHE_NAME = 'boardgame-scorepad-v2';

// 核心靜態資源 (使用絕對路徑以確保可靠性)
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
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
        return fetch(event.request).then((networkResponse) => {
          // 檢查回應是否有效 (Status 200)
          // 注意：type 'opaque' 是跨域回應 (如某些 CDN)，我們也允許快取它們
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
            return networkResponse;
          }

          // 3. 動態快取：複製一份回應存入快取
          // 這會自動捕捉到 app.tsx, CDN 函式庫等所有瀏覽器實際請求成功的檔案
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch((err) => {
          console.log('Fetch failed (Offline?):', err);
          // 這裡可以選擇回傳一個離線畫面，目前暫時留空
        });
      })
  );
});
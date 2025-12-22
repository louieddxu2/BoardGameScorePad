
const CACHE_NAME = 'boardgame-scorepad-v2.2.0-clean';

// 核心靜態資源
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Pre-caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // [策略] 只處理同源 (Same-Origin) 的 GET 請求
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // [策略] 忽略開發工具與 Vercel 特殊路徑
  if (url.pathname.includes('__vercel') || 
      url.pathname.startsWith('/@') || 
      url.pathname.includes('chrome-extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            // 關鍵修改：嚴格檢查回應狀態
            // Vercel 預覽環境的 Manifest 401 錯誤會在這裡被過濾掉，不會寫入快取
            // 404 (如舊的 index.css) 也會被過濾
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // 離線且無快取時的 Fallback
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

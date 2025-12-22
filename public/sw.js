
const CACHE_NAME = 'boardgame-scorepad-v2.1.1-release';

// 核心靜態資源
// 注意：不包含 index.css 或 manifest.json，這些由瀏覽器動態請求時快取
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

  // [過濾策略 1] 忽略非 GET 請求 (如 POST, PUT)
  if (event.request.method !== 'GET') return;

  // [過濾策略 2] 忽略跨域請求 (CDN, External APIs)
  // 這會解決 Google Fonts 和 Tailwind CDN 的 Status 0 錯誤
  // 讓瀏覽器直接處理這些外部資源，SW 不介入
  if (url.origin !== self.location.origin) return;

  // [過濾策略 3] 忽略開發環境雜訊 & Vercel 工具
  if (url.pathname.includes('__vercel') || 
      url.pathname.includes('_next') || 
      url.pathname.startsWith('/@vite') ||
      url.pathname.startsWith('/@react-refresh') ||
      url.pathname.includes('chrome-extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          // 確保回應有效且為 200 OK，才進行快取
          // 這樣可以避免快取到 404 (如 index.css) 或 401 (如受保護的 manifest)
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // 離線時的 Fallback (可選)
          // 如果請求的是頁面導航，可以回傳 index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

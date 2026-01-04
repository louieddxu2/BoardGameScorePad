
const CACHE_NAME = 'boardgame-scorepad-v21-stable';

// 核心靜態資源
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制讓新的 SW 立刻進入 waiting -> active
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
            console.log('SW: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim(); // 立即接管所有頁面控制權
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // [策略] 只處理同源 (Same-Origin) 的 GET 請求
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // [關鍵修正] 忽略開發工具、Vite 內部路徑與 Vercel 特殊路徑
  // 這能避免在開發環境中快取了 HMR 更新檔，導致瀏覽器卡在舊版
  if (url.pathname.includes('__vercel') || 
      url.pathname.startsWith('/@') || 
      url.pathname.includes('node_modules') ||
      url.pathname.includes('chrome-extension')) {
    return;
  }

  // ============================================================
  // 策略 1: HTML 頁面導航 -> Stale-While-Revalidate (舊換新策略)
  // ============================================================
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // 1. 先嘗試從快取讀取 (最快，且保證離線可用)
          const cachedResponse = await caches.match(event.request);
          
          // 2. 設定一個背景更新的 Promise (不管快取有沒有，都去網路抓新的存起來)
          const networkUpdate = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => {
             // 網路失敗沒關係，反正我們有快取
          });

          // 3. 如果有快取，直接回傳快取 (使用者看到的是舊版，但保證能用)
          if (cachedResponse) {
            return cachedResponse;
          }

          // 4. 如果沒有快取 (第一次來)，就等待網路回應
          const networkResponse = await networkUpdate;
          return networkResponse || caches.match('/index.html'); // 最後防線

        } catch (error) {
          console.log('Fetch failed:', error);
          return caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // ============================================================
  // 策略 2: 靜態資源 (JS/CSS/Images) -> Cache First (快取優先)
  // ============================================================
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            // 確保回應有效
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // 只有當資源真的存在時才快取 (避免快取到 404 頁面)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          });
      })
  );
});

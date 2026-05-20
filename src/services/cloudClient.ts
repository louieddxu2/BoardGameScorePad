import { GameTemplate } from '../types';

const CLOUD_SHARE_BASE_URL = import.meta.env.VITE_TEMPLATE_SHARE_API_BASE_URL || 'https://scoreboard-api.louieddxu2.workers.dev';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

type UploadResponse = { id: string; reused?: boolean };
type FetchResponse = { id: string; name: string; payload: unknown; downloadCount?: number; createdAt: number };

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      execute: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

const getTurnstileToken = async (): Promise<string> => {
  if (!TURNSTILE_SITE_KEY) {
    throw new Error('turnstile_site_key_missing');
  }

  await loadTurnstileScript();
  if (!window.turnstile) {
    throw new Error('turnstile_not_ready');
  }

  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    document.body.appendChild(container);

    let settled = false;
    let widgetId = '';

    const cleanup = () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      container.remove();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    widgetId = window.turnstile!.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'template_share_upload',
      execution: 'render', // Start as soon as rendered
      callback: (token: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(token);
      },
      'error-callback': () => fail('turnstile_failed'),
      'expired-callback': () => fail('turnstile_expired'),
    });

    setTimeout(() => fail('turnstile_timeout'), 45000);
  });
};

/**
 * SafeCloudClient
 * 雲端 API 客戶端：在最底層封裝網路請求，實作熔斷 (Cooldown) 與每日配額安全鎖 (500次上限)
 */
class SafeCloudClient {
  private cache: Record<string, any> = {};
  private lastFetchTime: Record<string, number> = {};
  private activeRequests: Record<string, Promise<any> | undefined> = {};
  private readonly cooldownMs = 5000; // 5 秒冷卻防線
  private readonly dailyLimit = 500;   // 每日每人成功向 D1 發送請求次數上限

  /**
   * 檢查並遞增每日成功打向 D1 的次數
   * @returns boolean 是否允許繼續呼叫 D1
   */
  private checkAndIncrementDailyLimit(): boolean {
    try {
      const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
      const storedDate = localStorage.getItem('cloud_api_daily_date');
      let count = parseInt(localStorage.getItem('cloud_api_daily_count') || '0', 10);

      // 新的一天，重置計數
      if (storedDate !== today) {
        localStorage.setItem('cloud_api_daily_date', today);
        count = 0;
        localStorage.setItem('cloud_api_daily_count', '0');
      }

      if (count >= this.dailyLimit) {
        console.warn(`[SafeCloudClient] ⚠️ 觸發每日 500 次限制防線！今日已成功呼叫 ${count} 次。阻斷請求。`);
        return false;
      }

      // 累加並寫回 (注意：此時先判定通過，真正成功呼叫後再呼叫 commit 增加)
      return true;
    } catch (e) {
      console.warn('[SafeCloudClient] 讀取 localStorage 失敗，預設放行。', e);
      return true;
    }
  }

  /**
   * 真正完成呼叫 D1 後，遞增本地 localStorage 的計數器
   */
  private commitDailyCallCount(): void {
    try {
      const count = parseInt(localStorage.getItem('cloud_api_daily_count') || '0', 10);
      localStorage.setItem('cloud_api_daily_count', (count + 1).toString());
    } catch (e) {
      // 忽視無痕模式的異常
    }
  }

  /**
   * 讀取雲端範本庫 (並發鎖定 + 5秒冷卻 + 每日500次上限)
   */
  async fetchPublicTemplates(): Promise<FetchResponse[]> {
    const cacheKey = 'public-templates';
    const now = Date.now();

    // 1. 並發重用：若有相同請求正在發送，直接重用 Promise
    if (this.activeRequests[cacheKey]) {
      console.warn('[SafeCloudClient] 偵測到並發公用範本讀取，重用進行中的請求 Promise');
      return this.activeRequests[cacheKey];
    }

    // 2. 冷卻熔斷：若在冷卻時間內且有快取，直接回傳記憶體快取
    if (this.cache[cacheKey] && (now - (this.lastFetchTime[cacheKey] || 0) < this.cooldownMs)) {
      console.log('[SafeCloudClient] 觸發 5 秒冷卻熔斷，回傳記憶體快取公用範本');
      return this.cache[cacheKey];
    }

    // 3. 發送真實 API 請求
    const requestPromise = (async () => {
      try {
        const data = await this.fetchPublicTemplatesRaw();
        this.cache[cacheKey] = data;
        this.lastFetchTime[cacheKey] = Date.now();
        return data;
      } finally {
        delete this.activeRequests[cacheKey];
      }
    })();

    this.activeRequests[cacheKey] = requestPromise;
    return requestPromise;
  }

  /**
   * 讀取單一雲端範本 (並發鎖定 + 5秒冷卻 + 每日500次上限)
   */
  async fetchTemplateFromCloud(cloudId: string): Promise<FetchResponse | null> {
    const cacheKey = `template-${cloudId}`;
    const now = Date.now();

    if (this.activeRequests[cacheKey]) {
      console.warn(`[SafeCloudClient] 偵測到並發讀取雲端範本 [${cloudId}]，重用進行中的請求`);
      return this.activeRequests[cacheKey];
    }

    if (this.cache[cacheKey] !== undefined && (now - (this.lastFetchTime[cacheKey] || 0) < this.cooldownMs)) {
      console.log(`[SafeCloudClient] 觸發 5 秒冷卻熔斷，回傳記憶體快取 [${cloudId}]`);
      return this.cache[cacheKey];
    }

    const requestPromise = (async () => {
      try {
        const data = await this.fetchTemplateFromCloudRaw(cloudId);
        this.cache[cacheKey] = data;
        this.lastFetchTime[cacheKey] = Date.now();
        return data;
      } finally {
        delete this.activeRequests[cacheKey];
      }
    })();

    this.activeRequests[cacheKey] = requestPromise;
    return requestPromise;
  }

  /**
   * 上傳範本 (並發鎖定 + 每日500次上限，不需冷卻)
   */
  async uploadTemplateToCloud(template: GameTemplate, lang?: string): Promise<UploadResponse> {
    const cacheKey = `upload-${template.id || 'new'}`;

    if (this.activeRequests[cacheKey]) {
      console.warn('[SafeCloudClient] 上傳請求已在進行中，忽略重複連點');
      return this.activeRequests[cacheKey];
    }

    const requestPromise = (async () => {
      try {
        return await this.uploadTemplateToCloudRaw(template, lang);
      } finally {
        delete this.activeRequests[cacheKey];
      }
    })();

    this.activeRequests[cacheKey] = requestPromise;
    return requestPromise;
  }

  // ==================== 底層網路實體 Fetch (私有) ====================

  private async fetchPublicTemplatesRaw(): Promise<FetchResponse[]> {
    // 檢查每日 500 次配額防線
    if (!this.checkAndIncrementDailyLimit()) {
      throw new Error('daily_limit_exceeded');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 秒超時

    try {
      const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/public-templates`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        this.commitDailyCallCount(); // 呼叫成功，正式寫入累加次數
        return await response.json() as FetchResponse[];
      }
      throw new Error('cloud_api_failed');
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Cloud D1 API failed or limit reached. Falling back to local mock-cloud-templates.json', error);
      const localResp = await fetch('/mock-cloud-templates.json');
      if (!localResp.ok) throw new Error('mock_fallback_failed');
      return await localResp.json() as FetchResponse[];
    }
  }

  private async fetchTemplateFromCloudRaw(cloudId: string): Promise<FetchResponse | null> {
    if (!this.checkAndIncrementDailyLimit()) {
      throw new Error('daily_limit_exceeded');
    }

    const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/${encodeURIComponent(cloudId)}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`fetch_failed_${response.status}_${text}`);
    }
    
    this.commitDailyCallCount(); // 呼叫成功，正式寫入累加次數
    return response.json() as Promise<FetchResponse>;
  }

  private async uploadTemplateToCloudRaw(template: GameTemplate, lang?: string): Promise<UploadResponse> {
    if (!this.checkAndIncrementDailyLimit()) {
      throw new Error('daily_limit_exceeded');
    }

    const {
      createdAt: _c,
      updatedAt: _u,
      lastSyncedAt: _s,
      imageId: _i,
      hasImage: _h,
      cloudImageId: _ci,
      ...sanitizedTemplate
    } = template;

    const token = await getTurnstileToken();
    const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: sanitizedTemplate.name,
        payload: sanitizedTemplate,
        lang,
        turnstileToken: token,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`upload_failed_${response.status}_${text}`);
    }

    this.commitDailyCallCount(); // 呼叫成功，正式寫入累加次數
    return response.json() as Promise<UploadResponse>;
  }
}

// 導出 Singleton 客戶端單例
export const cloudClient = new SafeCloudClient();
export type { FetchResponse, UploadResponse };

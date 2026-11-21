import { GameTemplate } from '../types';
import { getTurnstileToken } from './turnstile';

export const CLOUD_SHARE_BASE_URL = import.meta.env.VITE_TEMPLATE_SHARE_API_BASE_URL || 'https://scoreboard-api.louieddxu2.workers.dev';

type UploadResponse = { id: string; reused?: boolean };
type FetchResponse = { id: string; name: string; payload: unknown; downloadCount?: number; createdAt: number };

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
   * 清除記憶體快取 (在離開計分板畫面回到 Dashboard 時呼叫)
   */
  clearCache(): void {
    this.cache = {};
    this.lastFetchTime = {};
    console.log('[SafeCloudClient] 離開計分板，雲端快取已徹底清除。');
  }

  /**
   * 讀取單一雲端範本 (並發鎖定 + 生命週期快取 + 每日500次上限)
   */
  async fetchTemplateFromCloud(cloudId: string): Promise<FetchResponse | null> {
    const cacheKey = `template-${cloudId}`;

    if (this.activeRequests[cacheKey]) {
      console.warn(`[SafeCloudClient] 偵測到並發讀取雲端範本 [${cloudId}]，重用進行中的請求`);
      return this.activeRequests[cacheKey];
    }

    // 生命週期快取：只要快取有值且未被 clearCache 移除，直接回傳記憶體快取
    if (this.cache[cacheKey] !== undefined) {
      console.log(`[SafeCloudClient] 回傳記憶體快取 [${cloudId}] (計分板畫面內快取)`);
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
   * Full content of shared scoreboards already picked from the local share
   * catalog, by ID. The Worker reads one row per board; boards fetched before
   * on this screen come from the memory cache (shared boards never change).
   * Counts as one call toward the daily limit.
   */
  async fetchShareTemplatesByIds(ids: string[]): Promise<FetchResponse[]> {
    const unique = [...new Set(ids)];
    const cached = unique.map((id) => this.cache[`share-template-${id}`] as FetchResponse | undefined);
    const missing = unique.filter((_, i) => cached[i] === undefined);
    if (missing.length > 0) {
      if (!this.checkAndIncrementDailyLimit()) throw new Error('daily_limit_exceeded');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const url = `${CLOUD_SHARE_BASE_URL}/api/share/templates?ids=${missing.map(encodeURIComponent).join(',')}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('cloud_api_failed');
        this.commitDailyCallCount();
        const found = (await response.json()) as FetchResponse[];
        for (const item of found) this.cache[`share-template-${item.id}`] = item;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return unique.map((id) => this.cache[`share-template-${id}`] as FetchResponse | undefined).filter((t): t is FetchResponse => !!t);
  }

  /**
   * 上傳範本 (並發鎖定 + 每日500次上限，不需冷卻)
   */
  async uploadTemplateToCloud(
    template: GameTemplate,
    lang?: string,
    bggId?: string,
    bggName?: string
  ): Promise<UploadResponse> {
    const cacheKey = `upload-${template.id || 'new'}`;

    if (this.activeRequests[cacheKey]) {
      console.warn('[SafeCloudClient] 上傳請求已在進行中，忽略重複連點');
      return this.activeRequests[cacheKey];
    }

    const requestPromise = (async () => {
      try {
        return await this.uploadTemplateToCloudRaw(template, lang, bggId, bggName);
      } finally {
        delete this.activeRequests[cacheKey];
      }
    })();

    this.activeRequests[cacheKey] = requestPromise;
    return requestPromise;
  }

  // ==================== 底層網路實體 Fetch (私有) ====================

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
    const json = await response.json();
    
    // 智慧解析：相容單筆可能包裹於 results 陣列的情形
    if (json && typeof json === 'object') {
      if (Array.isArray((json as any).results)) {
        return ((json as any).results[0] as FetchResponse) || null;
      }
    }
    return json as FetchResponse;
  }

  private async uploadTemplateToCloudRaw(
    template: GameTemplate,
    lang?: string,
    bggId?: string,
    bggName?: string
  ): Promise<UploadResponse> {
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

    // 將 bggId 與 bggName 寫入 payload 內層，並同時作為頂層參數送出，使後端能智慧提取並相容
    const finalBggId = bggId || sanitizedTemplate.bggId;
    const payloadWithBgg = {
      ...sanitizedTemplate,
      bggId: finalBggId,
      bggName: bggName || undefined,
    };

    const token = await getTurnstileToken('template_share_upload');
    const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: sanitizedTemplate.name,
        payload: payloadWithBgg,
        lang,
        bggId: finalBggId,
        bggName,
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

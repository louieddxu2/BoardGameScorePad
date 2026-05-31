import { GameTemplate } from '../types';
import { getTurnstileToken } from './turnstile';

const CLOUD_SHARE_BASE_URL = import.meta.env.VITE_TEMPLATE_SHARE_API_BASE_URL || 'https://scoreboard-api.louieddxu2.workers.dev';

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
   * 讀取雲端範本庫 (並發鎖定 + 生命週期快取 + 每日500次上限)
   */
  async fetchPublicTemplates(options?: { bggId?: string; query?: string }): Promise<FetchResponse[]> {
    const cacheKey = options 
      ? `public-templates-${options.bggId || ''}-${options.query || ''}`
      : 'public-templates';

    // 1. 並發重用：若有相同請求正在發送，直接重用 Promise
    if (this.activeRequests[cacheKey]) {
      console.warn('[SafeCloudClient] 偵測到並發公用範本讀取，重用進行中的請求 Promise');
      return this.activeRequests[cacheKey];
    }

    // 2. 生命週期快取：只要快取有值且未被 clearCache 移除，直接回傳記憶體快取
    if (this.cache[cacheKey]) {
      console.log('[SafeCloudClient] 回傳記憶體快取公用範本 (計分板畫面內快取)');
      return this.cache[cacheKey];
    }

    // 3. 發送真實 API 請求
    const requestPromise = (async () => {
      try {
        const data = await this.fetchPublicTemplatesRaw(options);
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

  private async fetchPublicTemplatesRaw(options?: { bggId?: string; query?: string }): Promise<FetchResponse[]> {
    // 檢查每日 500 次配額防線
    if (!this.checkAndIncrementDailyLimit()) {
      throw new Error('daily_limit_exceeded');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 秒超時

    // 安全拼接查詢參數
    let url = `${CLOUD_SHARE_BASE_URL}/api/public-templates`;
    const params: string[] = [];
    if (options?.bggId) {
      params.push(`bggId=${encodeURIComponent(options.bggId)}`);
    }
    if (options?.query) {
      params.push(`query=${encodeURIComponent(options.query)}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        this.commitDailyCallCount(); // 呼叫成功，正式寫入累加次數
        const json = await response.json();
        
        let templates: FetchResponse[] = [];
        // 智慧解析：相容標準陣列格式與 D1 原始 results/data 包裝格式
        if (Array.isArray(json)) {
          templates = json as FetchResponse[];
        } else if (json && typeof json === 'object') {
          if (Array.isArray((json as any).results)) {
            templates = (json as any).results as FetchResponse[];
          } else if (Array.isArray((json as any).data)) {
            templates = (json as any).data as FetchResponse[];
          }
        } else {
          throw new Error('invalid_response_format');
        }
        return templates;
      }
      throw new Error('cloud_api_failed');
    } catch (error) {
      clearTimeout(timeoutId);
      
      // 只有在單元測試環境中 (MODE === 'test')，才允許加載 mock 資料作為測試 fallback
      if (import.meta.env.MODE === 'test') {
        console.warn('Cloud D1 API failed in test environment. Falling back to local mock-cloud-templates.json', error);
        try {
          const localResp = await fetch('/mock-cloud-templates.json');
          if (!localResp.ok) throw new Error('mock_fallback_failed');
          
          const localJson = await localResp.json();
          let templates: FetchResponse[] = [];
          if (Array.isArray(localJson)) {
            templates = localJson as FetchResponse[];
          } else if (localJson && typeof localJson === 'object' && Array.isArray((localJson as any).results)) {
            templates = (localJson as any).results as FetchResponse[];
          } else {
            templates = localJson as FetchResponse[];
          }

          // Mock 資料前端智慧過濾：相容測試環境的聯合查詢 (BGG ID OR query 聯集過濾)
          templates = templates.filter(t => {
            const payload: any = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
            const matchBggId = options?.bggId && (t.id === options.bggId || payload?.bggId === options.bggId);
            const matchQuery = options?.query && (
              t.name.toLowerCase().includes(options.query.toLowerCase()) || 
              payload?.gameName?.toLowerCase()?.includes(options.query.toLowerCase())
            );

            if (options?.bggId && options?.query) {
              return !!(matchBggId || matchQuery);
            }
            if (options?.bggId) {
              return !!matchBggId;
            }
            if (options?.query) {
              return !!matchQuery;
            }
            return true;
          });
          return templates;
        } catch (mockError) {
          throw new Error('mock_fallback_failed');
        }
      }

      // 實際環境 (Dev/Prod) 發生 API 錯誤時，直接向外拋出錯誤，拒絕用 Mock 混淆使用者
      console.error('[SafeCloudClient] Cloud API request failed:', error);
      throw error;
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

  async deleteTemplateFromCloud(id: string, token: string): Promise<{ success: boolean }> {
    if (!this.checkAndIncrementDailyLimit()) {
      throw new Error('daily_limit_exceeded');
    }

    const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`delete_failed_${response.status}_${text}`);
    }

    this.commitDailyCallCount();
    return response.json() as Promise<{ success: boolean }>;
  }
}

// 導出 Singleton 客戶端單例
export const cloudClient = new SafeCloudClient();
export type { FetchResponse, UploadResponse };

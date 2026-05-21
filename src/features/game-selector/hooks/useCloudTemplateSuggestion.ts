import { useState, useEffect } from 'react';
import { db } from '../../../db';
import { FetchResponse } from '../../../services/cloudClient';
import { fetchPublicTemplates } from '../../../services/templateShareService';

export const useCloudTemplateSuggestion = (
  gameName: string,
  bggId?: string,
  isOpen?: boolean
) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FetchResponse[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !gameName) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const performDiscovery = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuggestions([]);

        // 單次聯合查詢：同時傳入 bggId 與 query，確保 D1 僅被呼叫一次，由雲端進行 SQL 聯集查詢
        console.log(`[useCloudTemplateSuggestion] 執行聯合在線檢索 (BGG ID: ${bggId || '無'}, 查詢詞: ${gameName})...`);
        const results = await fetchPublicTemplates({ bggId, query: gameName });

        if (!isMounted) return;

        // 3. 讀取本地端已下載快取 (templateShareCache)，排除已經下載過的雲端範本，防止重複推薦
        const downloadedCaches = await db.templateShareCache.toArray();
        const downloadedCloudIds = new Set(downloadedCaches.map(c => c.cloudId));

        const filtered = results.filter(r => !downloadedCloudIds.has(r.id));

        // 4. 下載次數高到低排序 (為 Phase 3 鋪路)
        filtered.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));

        if (isMounted) {
          setSuggestions(filtered);
        }
      } catch (err: any) {
        console.error('[useCloudTemplateSuggestion] Background fetch public templates failed', err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    performDiscovery();

    return () => {
      isMounted = false;
    };
  }, [gameName, bggId, isOpen]);

  return { loading, suggestions, error };
};

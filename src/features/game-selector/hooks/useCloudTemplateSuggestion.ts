import { useState, useEffect } from 'react';
import { db } from '../../../db';
import { FetchResponse } from '../../../services/cloudClient';
import { fetchShareTemplatesByIds } from '../../../services/templateShareService';
import { syncCatalog } from '../../official-boards/catalogSync';
import type { ShareCatalogEntry } from '../../official-boards/types';

export interface CloudSuggestionItem extends FetchResponse {
  isDownloaded: boolean;
}

/** The Worker returns at most this many boards per request (one D1 row each). */
const MAX_SUGGESTIONS = 40;

const normalize = (text: string | null | undefined) => (text ?? '').trim().toLowerCase();

/**
 * Shared boards for a game in the local share catalog: same BGG ID, or a name
 * or BGG name containing the game name. Most played first.
 */
export const matchShareCatalog = (entries: ShareCatalogEntry[], gameName: string, bggId?: string): ShareCatalogEntry[] => {
  const query = normalize(gameName);
  return entries
    .filter(
      (e) =>
        (!!bggId && e.bggId === bggId) ||
        (!!query && (normalize(e.name).includes(query) || normalize(e.bggName).includes(query)))
    )
    .sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0) || b.createdAt - a.createdAt)
    .slice(0, MAX_SUGGESTIONS);
};

/**
 * Cloud scoreboards for the explore dialog. Which boards exist is decided from
 * the share catalog every device already syncs; only those boards' content is
 * then fetched by ID, so D1 reads one row per board shown and nothing when the
 * game has none.
 */
export const useCloudTemplateSuggestion = (
  gameName: string,
  bggId?: string,
  isOpen?: boolean
) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CloudSuggestionItem[]>([]);
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

        // Keeps the local catalog current on its usual schedule; a failure leaves the local copy in use.
        await syncCatalog('share').catch(() => undefined);
        const matches = matchShareCatalog(await db.shareCatalog.toArray(), gameName, bggId);
        if (!isMounted) return;
        if (matches.length === 0) {
          setSuggestions([]);
          return;
        }

        const results = await fetchShareTemplatesByIds(matches.map((m) => m.id));
        if (!isMounted) return;

        const downloadedCaches = await db.templateShareCache.toArray();
        const downloadedCloudIds = new Set(downloadedCaches.map(c => c.cloudId));
        // Keep the catalog's order (most downloaded first).
        const order = new Map(matches.map((m, i) => [m.id, i]));
        const mapped: CloudSuggestionItem[] = results
          .map(r => ({ ...r, isDownloaded: downloadedCloudIds.has(r.id) }))
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

        if (isMounted) {
          setSuggestions(mapped);
        }
      } catch (err: any) {
        console.error('[useCloudTemplateSuggestion] fetching shared boards failed', err);
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

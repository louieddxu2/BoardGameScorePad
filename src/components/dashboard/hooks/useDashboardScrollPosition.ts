import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject, UIEvent } from 'react';

import type { DashboardMode } from '../dashboardMode';

/** Keep one position per existing view, not a second mounted list or query. */
export const useDashboardScrollPosition = (
  containerRef: RefObject<HTMLElement>,
  viewMode: DashboardMode,
  searchQuery: string,
) => {
  const positionsRef = useRef<Record<DashboardMode, number>>({ settings: 0, library: 0, history: 0 });
  const activeModeRef = useRef(viewMode);
  const query = searchQuery.trim();
  const queryRef = useRef(query);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (queryRef.current !== query) {
      // Both modes now display a different result set. Old heights are invalid.
      positionsRef.current = { settings: 0, library: 0, history: 0 };
      queryRef.current = query;
    }
    activeModeRef.current = viewMode;
    container.scrollTop = positionsRef.current[viewMode];
  }, [containerRef, viewMode, query]);

  return useCallback((event: UIEvent<HTMLElement>) => {
    positionsRef.current[activeModeRef.current] = Math.max(0, event.currentTarget.scrollTop);
  }, []);
};

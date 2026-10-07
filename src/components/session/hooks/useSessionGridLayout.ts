import { useEffect, useMemo, useState } from 'react';
import type { GameTemplate } from '../../../types';
import type { ScreenshotLayout, useSessionState } from './useSessionState';

type GridAlignmentRefs = Pick<ReturnType<typeof useSessionState>,
  'tableContainerRef' | 'totalBarScrollRef' | 'gridContentRef' | 'totalContentRef'
>;

export const useSessionItemWidth = (playerCount: number): number => {
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const leftColWidth = useMemo(() => {
    if (containerWidth > 0) {
      return Math.max(70, containerWidth / (playerCount + 2));
    }
    return 70;
  }, [containerWidth, playerCount]);

  return leftColWidth;
};

// Read the existing board only when a screenshot is requested.
export const measureSessionScreenshotLayout = (
  columns: GameTemplate['columns'],
): ScreenshotLayout | null => {
  const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
  const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
  const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');
  const totalsRowEl = document.querySelector('#live-totals-bar') as HTMLElement;

  if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
    return null;
  }

  const measuredLayout: ScreenshotLayout = {
    itemWidth: itemHeaderEl.offsetWidth,
    playerWidths: {},
    playerHeaderHeight: playerHeaderRowEl.offsetHeight,
    rowHeights: {},
    totalRowHeight: totalsRowEl ? totalsRowEl.offsetHeight : undefined
  };

  playerHeaderEls.forEach(el => {
    const playerId = el.getAttribute('data-player-header-id');
    if (playerId) measuredLayout.playerWidths[playerId] = (el as HTMLElement).offsetWidth;
  });

  columns.forEach(col => {
    const rowEl = document.getElementById(`row-${col.id}`) as HTMLElement;
    if (rowEl) measuredLayout.rowHeights[col.id] = rowEl.offsetHeight;
  });

  return measuredLayout;
};

export const useSessionGridAlignment = (sessionState: GridAlignmentRefs): void => {
  // Sync Scroll & Width Observers (same as before)
  useEffect(() => {
    const grid = sessionState.tableContainerRef.current;
    const bar = sessionState.totalBarScrollRef.current;
    if (!grid || !bar) return;
    const handleScroll = () => { if (bar.scrollLeft !== grid.scrollLeft) bar.scrollLeft = grid.scrollLeft; };
    grid.addEventListener('scroll', handleScroll, { passive: true });
    return () => grid.removeEventListener('scroll', handleScroll);
  }, [sessionState.tableContainerRef, sessionState.totalBarScrollRef]);

  useEffect(() => {
    const gridContent = sessionState.gridContentRef.current;
    const totalContent = sessionState.totalContentRef.current;
    if (!gridContent || !totalContent) return;
    const observer = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === gridContent) {
            const gridWidth = gridContent.offsetWidth;
            const stickyHeader = document.querySelector('#live-player-header-row > div:first-child') as HTMLElement;
            const headerOffset = stickyHeader ? stickyHeader.offsetWidth : 70;
            const newTotalWidth = `${Math.max(0, gridWidth - headerOffset)}px`;
            if (totalContent.style.width !== newTotalWidth) totalContent.style.width = newTotalWidth;
          }
        }
      });
    });
    observer.observe(gridContent);
    return () => observer.disconnect();
  }, [sessionState.gridContentRef, sessionState.totalContentRef]);
};

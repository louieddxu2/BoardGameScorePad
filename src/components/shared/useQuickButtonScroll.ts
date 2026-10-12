import { useCallback, useLayoutEffect, useRef } from 'react';
import type { UIEvent } from 'react';

export type QuickButtonScrollPositions = Map<string, number>;

const clampScrollTop = (container: HTMLElement, top: number) =>
  Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));

const revealSelection = (container: HTMLElement) => {
  if (container.clientHeight <= 0) return;
  const viewportTop = container.getBoundingClientRect().top + container.clientTop;
  const viewportBottom = viewportTop + container.clientHeight;
  let firstRect: DOMRect | undefined;
  for (const button of container.querySelectorAll<HTMLElement>('[data-quick-action-selected="true"]')) {
    const rect = button.getBoundingClientRect();
    if (!firstRect) firstRect = rect;
    if (rect.top >= viewportTop && rect.bottom <= viewportBottom) return;
  }
  if (!firstRect) return;
  const delta = firstRect.top < viewportTop || firstRect.height > container.clientHeight
    ? firstRect.top - viewportTop - 8
    : firstRect.bottom - viewportBottom + 8;
  container.scrollTop = clampScrollTop(container, container.scrollTop + delta);
};

/** The InputPanel owns the memory so closing the pad does not erase it. */
export const useQuickButtonScroll = (
  columnId: string,
  hasActions: boolean,
  scrollPositions?: QuickButtonScrollPositions,
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const localPositionsRef = useRef<QuickButtonScrollPositions | null>(null);
  if (localPositionsRef.current === null) localPositionsRef.current = new Map();
  const positions = scrollPositions ?? localPositionsRef.current;
  const activeColumnRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !hasActions) {
      activeColumnRef.current = null;
      return;
    }
    const isOpening = activeColumnRef.current === null;
    activeColumnRef.current = columnId;
    container.scrollTop = clampScrollTop(container, positions.get(columnId) ?? 0);
    // Only reopening may reveal a filled option. Selecting another option or
    // changing player in the same column must never move a rapid-input list.
    if (isOpening) revealSelection(container);
    positions.set(columnId, container.scrollTop);
  }, [columnId, hasActions, positions]);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (activeColumnRef.current !== null) {
      positions.set(activeColumnRef.current, Math.max(0, event.currentTarget.scrollTop));
    }
  }, [positions]);

  return { containerRef, onScroll };
};

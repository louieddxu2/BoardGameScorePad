export const isSessionViewportDiagnosticsEnabled = (search: string): boolean =>
  new URLSearchParams(search).get('debugViewport') === '1';

export const getElementOverflow = (clientHeight: number, scrollHeight: number): number =>
  Math.max(0, scrollHeight - clientHeight);

export const getViewportBottomDelta = (
  elementBottom: number,
  visualViewportHeight: number,
  visualViewportOffsetTop: number,
): number => elementBottom - (visualViewportOffsetTop + visualViewportHeight);

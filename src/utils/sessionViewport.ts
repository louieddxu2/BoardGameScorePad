export const getSessionPanelDockOffset = (keyboardOffset: number): string =>
  keyboardOffset > 0 ? `${keyboardOffset}px` : 'var(--bottom-ui-safe-gap)';

export const getSessionOccupiedBottom = (
  panelHeight: string,
  keyboardOffset: number,
): string => `calc(${panelHeight} + ${getSessionPanelDockOffset(keyboardOffset)})`;

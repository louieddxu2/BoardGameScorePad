export const getSessionPanelDockOffset = (
  keyboardOffset: number,
  isKeyboardOpen: boolean,
): string => isKeyboardOpen ? `${keyboardOffset}px` : 'var(--bottom-ui-safe-gap)';

export const getSessionOccupiedBottom = (
  panelHeight: string,
  keyboardOffset: number,
  isKeyboardOpen: boolean,
): string => `calc(${panelHeight} + ${getSessionPanelDockOffset(keyboardOffset, isKeyboardOpen)})`;

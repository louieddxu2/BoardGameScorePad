import { describe, expect, it } from 'vitest';
import { getSessionOccupiedBottom, getSessionPanelDockOffset } from './sessionViewport';

describe('session viewport layout', () => {
  it('uses the shared safe gap when the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(0)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('min(100dvh, max(40dvh, 240px))', 0)).toBe(
      'calc(min(100dvh, max(40dvh, 240px)) + var(--bottom-ui-safe-gap))',
    );
  });

  it('uses the visual viewport offset without adding the safe gap when the keyboard is open', () => {
    expect(getSessionPanelDockOffset(300)).toBe('300px');
    expect(getSessionOccupiedBottom('220px', 300)).toBe('calc(220px + 300px)');
  });
});

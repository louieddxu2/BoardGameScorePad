import { describe, expect, it } from 'vitest';
import { getSessionOccupiedBottom, getSessionPanelDockOffset } from './sessionViewport';

describe('session viewport layout', () => {
  it('uses the shared safe gap when the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(0, false)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('min(100dvh, max(40dvh, 240px))', 0, false)).toBe(
      'calc(min(100dvh, max(40dvh, 240px)) + var(--bottom-ui-safe-gap))',
    );
  });

  it('uses the visual viewport offset without adding the safe gap when the keyboard is open', () => {
    expect(getSessionPanelDockOffset(300, true)).toBe('300px');
    expect(getSessionOccupiedBottom('220px', 300, true)).toBe('calc(220px + 300px)');
  });

  it('keeps the safe gap for a small viewport offset that is not the keyboard', () => {
    expect(getSessionPanelDockOffset(20, false)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('220px', 20, false)).toBe(
      'calc(220px + var(--bottom-ui-safe-gap))',
    );
  });
});

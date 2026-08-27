import { describe, expect, it } from 'vitest';
import { getSessionOccupiedBottom, getSessionPanelDockOffset } from './sessionViewport';

describe('session viewport layout', () => {
  it('uses the shared safe gap when the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(0)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('min(100dvh, max(40dvh, 240px))', 0)).toBe(
      'calc(min(100dvh, max(40dvh, 240px)) + var(--bottom-ui-safe-gap))',
    );
  });

  it('uses the visual viewport offset while preserving the platform safe gap', () => {
    expect(getSessionPanelDockOffset(300)).toBe(
      'max(300px, var(--bottom-ui-safe-gap))',
    );
    expect(getSessionOccupiedBottom('220px', 300)).toBe(
      'calc(220px + max(300px, var(--bottom-ui-safe-gap)))',
    );
  });

  it('preserves a small visual viewport obstruction even when it is not the keyboard', () => {
    expect(getSessionPanelDockOffset(64)).toBe(
      'max(64px, var(--bottom-ui-safe-gap))',
    );
    expect(getSessionOccupiedBottom('220px', 64)).toBe(
      'calc(220px + max(64px, var(--bottom-ui-safe-gap)))',
    );
  });
});

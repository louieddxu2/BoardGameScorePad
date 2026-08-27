import { describe, expect, it } from 'vitest';
import {
  getSessionOccupiedBottom,
  getSessionPanelDockOffset,
  getSessionPanelHeight,
} from './sessionViewport';

describe('session viewport layout', () => {
  it('uses the shared safe gap when the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(0)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('min(100dvh, max(40dvh, 240px))', 0)).toBe(
      'calc(min(100dvh, max(40dvh, 240px)) + var(--bottom-ui-safe-gap))',
    );
  });

  it('uses the visual viewport offset while preserving the platform safe gap', () => {
    expect(getSessionPanelDockOffset(300, true)).toBe('300px');
    expect(getSessionOccupiedBottom('220px', 300, true)).toBe('calc(220px + 300px)');
  });

  it('does not treat a non-keyboard visual viewport delta as a toolbar height', () => {
    expect(getSessionPanelDockOffset(64, false)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('220px', 64, false)).toBe(
      'calc(220px + var(--bottom-ui-safe-gap))',
    );
  });

  it('uses the conservative small viewport units for iOS Safari', () => {
    expect(getSessionPanelHeight(true)).toBe('min(100svh, max(40svh, 240px))');
    expect(getSessionPanelHeight(false)).toBe('min(100dvh, max(40dvh, 240px))');
  });
});

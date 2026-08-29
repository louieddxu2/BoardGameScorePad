import { describe, expect, it } from 'vitest';
import {
  getSessionOccupiedBottom,
  getSessionPanelDockOffset,
  getSessionPanelHeight,
  IOS_BROWSER_BOTTOM_RESERVE,
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

  it('reserves the iOS browser toolbar area while the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(64, false, IOS_BROWSER_BOTTOM_RESERVE)).toBe(IOS_BROWSER_BOTTOM_RESERVE);
    expect(getSessionOccupiedBottom('220px', 64, false, IOS_BROWSER_BOTTOM_RESERVE)).toBe(
      `calc(220px + ${IOS_BROWSER_BOTTOM_RESERVE})`,
    );
    expect(getSessionPanelDockOffset(300, true, IOS_BROWSER_BOTTOM_RESERVE)).toBe('300px');
  });

  it('subtracts the reserved toolbar area from the iOS browser panel height', () => {
    expect(getSessionPanelHeight(true)).toBe(
      'min(calc(100svh - clamp(80px, 8svh, 96px)), max(calc(40svh - clamp(80px, 8svh, 96px)), 240px))',
    );
    expect(getSessionPanelHeight(false)).toBe('min(100dvh, max(40dvh, 240px))');
  });
});

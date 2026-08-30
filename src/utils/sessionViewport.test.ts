import { describe, expect, it } from 'vitest';
import {
  getSessionOccupiedBottom,
  getSessionPanelDockOffset,
} from './sessionViewport';

describe('session viewport layout', () => {
  it('uses the shared safe gap when the keyboard is closed', () => {
    expect(getSessionPanelDockOffset(0)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('40vh', 0)).toBe(
      'calc(40vh + var(--bottom-ui-safe-gap))',
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

  it('does not add a guessed toolbar reserve to the idle iOS layout', () => {
    expect(getSessionPanelDockOffset(64, false)).toBe('var(--bottom-ui-safe-gap)');
    expect(getSessionOccupiedBottom('40vh', 64, false)).toBe(
      'calc(40vh + var(--bottom-ui-safe-gap))',
    );
  });
});

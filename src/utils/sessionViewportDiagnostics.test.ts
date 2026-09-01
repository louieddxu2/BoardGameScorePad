import { describe, expect, it } from 'vitest';
import {
  getElementOverflow,
  getViewportBottomDelta,
  isSessionViewportDiagnosticsEnabled,
} from './sessionViewportDiagnostics';

describe('session viewport diagnostics', () => {
  it('only enables the overlay through the explicit debug query flag', () => {
    expect(isSessionViewportDiagnosticsEnabled('?debugViewport=1')).toBe(true);
    expect(isSessionViewportDiagnosticsEnabled('?debugViewport=0')).toBe(false);
    expect(isSessionViewportDiagnosticsEnabled('')).toBe(false);
  });

  it('reports internal overflow independently from viewport clipping', () => {
    expect(getElementOverflow(340, 390)).toBe(50);
    expect(getElementOverflow(340, 320)).toBe(0);
    expect(getViewportBottomDelta(780, 720, 0)).toBe(60);
    expect(getViewportBottomDelta(700, 720, 0)).toBe(-20);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installTouchDiagnostics,
  recordScoreHandlerDecision,
  touchDiagnostics,
} from './touchDiagnostics';
import type { TouchDiagnosticState } from './touchDiagnostics';

const state: TouchDiagnosticState = {
  editingCell: null,
  editingPlayerId: null,
  isInputFocused: false,
  isToolboxOpen: false,
  isEditMode: false,
};

const dispatchTouchEvent = (target: Element, type: 'touchstart' | 'touchend' | 'touchcancel') => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'changedTouches', {
    configurable: true,
    value: [{ clientX: 24, clientY: 48 }],
  });
  target.dispatchEvent(event);
};

describe('touch diagnostics', () => {
  let host: HTMLDivElement;
  let cell: HTMLDivElement;
  let cleanup: (() => void) | undefined;
  let restoreConsoleInfo: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    restoreConsoleInfo = () => consoleInfoSpy.mockRestore();
    touchDiagnostics.disable();
    touchDiagnostics.clear();
    host = document.createElement('div');
    cell = document.createElement('div');
    cell.dataset.scoreCell = 'p1:c1';
    host.appendChild(cell);
    document.body.appendChild(host);
    touchDiagnostics.enable();
    cleanup = installTouchDiagnostics(host, () => state);
  });

  afterEach(() => {
    cleanup?.();
    host.remove();
    touchDiagnostics.disable();
    touchDiagnostics.clear();
    vi.useRealTimers();
    restoreConsoleInfo?.();
  });

  it('marks a touch sequence when no compatibility click follows', () => {
    dispatchTouchEvent(cell, 'touchstart');
    dispatchTouchEvent(cell, 'touchend');

    vi.advanceTimersByTime(901);

    const entries = touchDiagnostics.getEntries();
    expect(entries.map((entry) => entry.kind)).toEqual([
      'touchstart',
      'touchend',
      'tap-without-click',
    ]);
    expect(entries[2].scoreCell).toBe('p1:c1');
  });

  it('correlates a compatibility click and does not report a false missing click', () => {
    dispatchTouchEvent(cell, 'touchend');
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 24, clientY: 48 }));

    vi.advanceTimersByTime(901);

    const entries = touchDiagnostics.getEntries();
    const lastEntry = entries[entries.length - 1];
    expect(lastEntry?.kind).toBe('click');
    expect(lastEntry?.correlation).toBe('matched');
    expect(entries.some((entry) => entry.kind === 'tap-without-click')).toBe(false);
  });

  it('records whether the score handler accepted the event', () => {
    recordScoreHandlerDecision({
      event: new MouseEvent('click', { bubbles: true }),
      state,
      playerId: 'p1',
      columnId: 'c1',
      accepted: false,
      reason: 'capability-rejected',
    });

    const entry = touchDiagnostics.getEntries()[0];
    expect(entry.kind).toBe('score-handler');
    expect(entry.scoreCell).toBe('p1:c1');
    expect(entry.outcome).toBe('rejected:capability-rejected');
  });
});

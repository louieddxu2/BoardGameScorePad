import { describe, expect, it, vi } from 'vitest';
import { AppView } from '../types';
import { isExplicitActiveSessionEntry, navigateToActiveSession } from './activeSessionNavigation';

describe('active session navigation gate', () => {
  it('allows only explicit user or QR entry sources', () => {
    expect(isExplicitActiveSessionEntry('qr-join')).toBe(true);
    expect(isExplicitActiveSessionEntry('resume-active-session')).toBe(true);
    expect(isExplicitActiveSessionEntry('start-new-session')).toBe(true);
    expect(isExplicitActiveSessionEntry('background-reconnect')).toBe(false);
    expect(isExplicitActiveSessionEntry('remote-bootstrap')).toBe(false);
  });

  it('does not navigate for a background reconnect attempt', () => {
    const setView = vi.fn();

    expect(navigateToActiveSession(setView, 'background-reconnect' as never)).toBe(false);
    expect(setView).not.toHaveBeenCalled();
  });

  it('navigates only after an explicit entry is accepted', () => {
    const setView = vi.fn();

    expect(navigateToActiveSession(setView, 'resume-active-session')).toBe(true);
    expect(setView).toHaveBeenCalledWith(AppView.ACTIVE_SESSION);
  });
});

import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import OfficialAdminCard from './OfficialAdminCard';
import { clearCloudSession, SESSION_EVENT, SESSION_STORAGE_KEY } from '../../../services/cloud/cloudSession';

vi.mock('../../../i18n/officialBoards', () => ({
  useOfficialBoardsTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params?.date ? `${key}:${params.date}` : key) }),
}));

describe('OfficialAdminCard sign-in status', () => {
  afterEach(() => clearCloudSession());

  it('offers to sign this device in when it has no session', () => {
    clearCloudSession();
    render(<OfficialAdminCard />);
    expect(screen.getByText('official_session_off')).toBeTruthy();
    expect(screen.getByText('official_session_sign_in')).toBeTruthy();
  });

  it('shows until when this device is signed in, and updates when the session changes', () => {
    const expiresAt = Date.now() + 10 * 24 * 60 * 60 * 1000;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 's1.a.b', expiresAt, isAdmin: true }));
    render(<OfficialAdminCard />);
    expect(screen.getByText(`official_session_on:${new Date(expiresAt).toLocaleDateString()}`)).toBeTruthy();

    act(() => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new Event(SESSION_EVENT));
    });
    expect(screen.getByText('official_session_off')).toBeTruthy();
  });
});

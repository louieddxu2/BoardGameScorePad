import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const googleState = vi.hoisted(() => ({ isAuthorized: true, token: 'google-token' as string | null, signIn: vi.fn(async () => 'signed-in-token') }));
vi.mock('./googleAuth', () => ({
  googleAuth: {
    get isAuthorized() {
      return googleState.isAuthorized;
    },
    get token() {
      return googleState.token;
    },
    signIn: googleState.signIn,
  },
}));

import { fetchPublishTarget } from '../../features/official-boards/officialApi';
import { clearCloudSession, ensureCloudSession, getDeviceKey, readCloudSession, signRequest, SESSION_STORAGE_KEY } from './cloudSession';

const DAY = 24 * 60 * 60 * 1000;
type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;
const mockWorker = (route: Route) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => route(new URL(String(input)), init ?? {}));

const fromBase64Url = (text: string) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

describe('device-bound cloud session', () => {
  beforeEach(() => {
    clearCloudSession();
    googleState.isAuthorized = true;
    googleState.token = 'google-token';
    googleState.signIn.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts from the Google token the app already has, sending only the public key', async () => {
    const fetchMock = mockWorker(async (url, init) => {
      expect(url.pathname).toBe('/api/auth/session');
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer google-token');
      const { publicKey } = JSON.parse(String(init.body));
      expect(publicKey).toMatchObject({ kty: 'EC', crv: 'P-256' });
      expect(publicKey.d).toBeUndefined();
      return Response.json({ token: 's1.a.b', expiresAt: Date.now() + 30 * DAY, isAdmin: true });
    });
    const session = await ensureCloudSession({ interactive: false });
    expect(session).toMatchObject({ token: 's1.a.b', isAdmin: true });
    expect(readCloudSession()).toMatchObject({ token: 's1.a.b' });
    // Stored and fresh: no further calls.
    await ensureCloudSession({ interactive: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(googleState.signIn).not.toHaveBeenCalled();
  });

  it('renews a session in its last week, signed by the device', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 's1.old.sig', expiresAt: Date.now() + 2 * DAY, isAdmin: true }));
    mockWorker(async (url, init) => {
      expect(url.pathname).toBe('/api/auth/refresh');
      const headers = new Headers(init.headers);
      expect(headers.get('authorization')).toBe('Bearer s1.old.sig');
      expect(headers.get('x-session-proof')).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
      return Response.json({ token: 's1.new.sig', expiresAt: Date.now() + 30 * DAY, isAdmin: true });
    });
    expect((await ensureCloudSession({ interactive: false })).token).toBe('s1.new.sig');
  });

  it('does not show Google sign-in unless the caller allows it', async () => {
    googleState.isAuthorized = false;
    googleState.token = null;
    await expect(ensureCloudSession({ interactive: false })).rejects.toMatchObject({ code: 'not_signed_in' });
    expect(googleState.signIn).not.toHaveBeenCalled();
  });

  it('signs method, path, time and body so the Worker can verify them with the public key', async () => {
    const now = 1_800_000_000_000;
    const proof = await signRequest('post', '/api/admin/official/publish', '{"a":1}', now);
    const [stamp, signature] = proof.split('.');
    expect(Number(stamp)).toBe(now);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('{"a":1}'))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const message = new TextEncoder().encode(`POST\n/api/admin/official/publish\n${now}\n${digest}`);
    const { publicKey } = await getDeviceKey();
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, fromBase64Url(signature), message)).toBe(true);
  });

  it('replaces a stale session once and retries the admin call', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 's1.stale.sig', expiresAt: Date.now() + 20 * DAY, isAdmin: true }));
    const calls: string[] = [];
    mockWorker(async (url, init) => {
      calls.push(`${url.pathname} ${new Headers(init.headers).get('authorization')}`);
      if (url.pathname === '/api/auth/session') return Response.json({ token: 's1.fresh.sig', expiresAt: Date.now() + 30 * DAY, isAdmin: true });
      if (new Headers(init.headers).get('authorization') === 'Bearer s1.stale.sig') {
        return Response.json({ error: 'invalid_session_proof' }, { status: 401 });
      }
      return Response.json({ exists: false, bggId: '1', lang: 'en', nextVersion: 1 });
    });
    expect(await fetchPublishTarget('1', 'en')).toMatchObject({ exists: false });
    expect(calls).toEqual([
      '/api/admin/official/target Bearer s1.stale.sig',
      '/api/auth/session Bearer google-token',
      '/api/admin/official/target Bearer s1.fresh.sig',
    ]);
  });
});

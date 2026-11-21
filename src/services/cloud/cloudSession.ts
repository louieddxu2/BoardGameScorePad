/**
 * Device-bound sign-in with the scoreboard Worker.
 *
 * The device keeps a P-256 key pair that the browser will not export, stored
 * in its own IndexedDB database. Signing in sends the public key with the
 * Google access token the app already has from connecting Google Drive; the
 * Worker answers with a 30-day session. Every request is then signed with the
 * private key, so a copied session is useless on another device. Sessions are
 * renewed automatically in their last week, so a device used at least monthly
 * stays signed in. Disconnecting Google Drive signs out.
 */
import { CLOUD_SHARE_BASE_URL } from '../cloudClient';
import { googleAuth } from './googleAuth';

export const SESSION_STORAGE_KEY = 'sm_cloud_session';
export const SESSION_EVENT = 'sm-cloud-session';
const PROOF_HEADER = 'x-session-proof';
const RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_DB = 'sm-device-keys';
const KEY_STORE = 'keys';
const KEY_ID = 'session';

export type CloudSession = { token: string; expiresAt: number; isAdmin: boolean };

export class CloudSessionError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

// --- Stored session -----------------------------------------------------------

export const readCloudSession = (now = Date.now()): CloudSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as CloudSession) : null;
    return session && typeof session.token === 'string' && session.expiresAt > now ? session : null;
  } catch {
    return null;
  }
};

const announce = () => {
  try {
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    // No window (tests without DOM): nothing listens.
  }
};

const writeCloudSession = (session: CloudSession) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Without storage the session lasts for this page only.
    memorySession = session;
  }
  announce();
};

let memorySession: CloudSession | null = null;
const currentSession = () => readCloudSession() ?? (memorySession && memorySession.expiresAt > Date.now() ? memorySession : null);

export const clearCloudSession = () => {
  memorySession = null;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
  announce();
};

// --- Device key ---------------------------------------------------------------

let memoryKey: CryptoKeyPair | null = null;

const openKeyDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const keyStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await openKeyDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(KEY_STORE, mode).objectStore(KEY_STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

/** The device's key pair; the private key cannot be exported, even by this app. */
export const getDeviceKey = async (): Promise<CryptoKeyPair> => {
  if (memoryKey) return memoryKey;
  try {
    const stored = await keyStore<CryptoKeyPair | undefined>('readonly', (s) => s.get(KEY_ID));
    if (stored?.privateKey && stored?.publicKey) return (memoryKey = stored);
  } catch {
    // No IndexedDB: the key lives for this page only.
  }
  const created = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  try {
    await keyStore('readwrite', (s) => s.put(created, KEY_ID));
  } catch {
    // Kept in memory only.
  }
  return (memoryKey = created);
};

const toBase64Url = (bytes: ArrayBuffer) => {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const sha256Hex = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** The proof header for one request: timestamp plus a signature over method, path, time and body. */
export const signRequest = async (method: string, pathAndQuery: string, body = '', now = Date.now()): Promise<string> => {
  const keys = await getDeviceKey();
  const message = `${method.toUpperCase()}\n${pathAndQuery}\n${now}\n${await sha256Hex(body)}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(message));
  return `${now}.${toBase64Url(signature)}`;
};

// --- Talking to the Worker ------------------------------------------------------

const postJson = async (path: string, headers: Record<string, string>, body?: string): Promise<any> => {
  const response = await fetch(`${CLOUD_SHARE_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    body,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new CloudSessionError(data?.error || `http_${response.status}`, response.status);
  return data;
};

const start = async (googleToken: string): Promise<CloudSession> => {
  const keys = await getDeviceKey();
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const data = await postJson('/api/auth/session', { authorization: `Bearer ${googleToken}` }, JSON.stringify({ publicKey }));
  const session: CloudSession = { token: data.token, expiresAt: data.expiresAt, isAdmin: !!data.isAdmin };
  writeCloudSession(session);
  return session;
};

const renew = async (session: CloudSession): Promise<CloudSession> => {
  const proof = await signRequest('POST', '/api/auth/refresh');
  const data = await postJson('/api/auth/refresh', { authorization: `Bearer ${session.token}`, [PROOF_HEADER]: proof });
  const next: CloudSession = { token: data.token, expiresAt: data.expiresAt, isAdmin: !!data.isAdmin };
  writeCloudSession(next);
  return next;
};

let pending: Promise<CloudSession> | null = null;

/**
 * A usable session: the stored one (renewed in its last week), or a new one
 * from the Google token the app already holds. Only `interactive` calls may
 * show Google's sign-in.
 */
export const ensureCloudSession = (options: { interactive: boolean }): Promise<CloudSession> => {
  if (pending) return pending;
  pending = (async () => {
    const session = currentSession();
    if (session) {
      if (session.expiresAt - Date.now() < RENEW_WITHIN_MS) {
        return renew(session).catch(() => session);
      }
      return session;
    }
    const googleToken =
      googleAuth.isAuthorized && googleAuth.token
        ? googleAuth.token
        : options.interactive
          ? await googleAuth.signIn()
          : null;
    if (!googleToken) throw new CloudSessionError('not_signed_in', 401);
    return start(googleToken);
  })().finally(() => {
    pending = null;
  });
  return pending;
};

/**
 * Headers for a signed request to the Worker. Pass the exact body that will be
 * sent; the signature covers it.
 */
export const sessionHeaders = async (
  method: string,
  pathAndQuery: string,
  body: string | undefined,
  options: { interactive: boolean }
): Promise<Record<string, string>> => {
  const session = await ensureCloudSession(options);
  return { authorization: `Bearer ${session.token}`, [PROOF_HEADER]: await signRequest(method, pathAndQuery, body ?? '') };
};

/** Errors meaning the stored session or device key no longer works; signing in again fixes them. */
export const isStaleSessionError = (code: string) => code === 'invalid_session' || code === 'invalid_session_proof';

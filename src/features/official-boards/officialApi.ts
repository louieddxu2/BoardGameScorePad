/**
 * Worker API for official (cloud built-in) and shared scoreboard catalogs.
 * Public reads need no account; admin calls carry the Google access token.
 */
import { CLOUD_SHARE_BASE_URL } from '../../services/cloudClient';
import {
  clearCloudSessionIfTokenMatches,
  CloudSessionError,
  isStaleSessionError,
  sessionHeaders,
} from '../../services/cloud/cloudSession';
import type { GameTemplate } from '../../types';
import type {
  CatalogChangesPayload,
  CatalogKind,
  CatalogSnapshotPayload,
  GameCatalogEntry,
  OfficialCatalogEntry,
  OfficialPackPayload,
  OfficialPublishResult,
  OfficialPublishTarget,
  OfficialVersionSummary,
  ShareCatalogEntry,
} from './types';

const REQUEST_TIMEOUT_MS = 15000;

export class OfficialApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly body?: any) {
    super(code);
  }
}

const request = async <T>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${CLOUD_SHARE_BASE_URL}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new OfficialApiError(body?.error || `http_${response.status}`, response.status, body);
    return body as T;
  } catch (error) {
    if (error instanceof OfficialApiError) throw error;
    throw new OfficialApiError((error as Error)?.name === 'AbortError' ? 'timeout' : 'network_error', 0);
  } finally {
    clearTimeout(timer);
  }
};

/** The share catalog: a snapshot plus changes after a version. */
export const fetchCatalogSnapshot = <T extends ShareCatalogEntry>(_kind: 'share') =>
  request<CatalogSnapshotPayload<T>>('/api/share/catalog');

export const fetchCatalogChanges = <T extends ShareCatalogEntry>(_kind: 'share', after: number) =>
  request<CatalogChangesPayload<T>>(`/api/share/catalog/changes?after=${after}`);

/** The game catalog's current generation: one D1 row, so devices can tell whether to download. */
export const fetchGameCatalogVersion = () => request<{ generation: number; generatedAt: number }>('/api/games/catalog/version');

/** The whole game catalog: every game with its names, official boards and rules (a few D1 rows). */
export const fetchGameCatalog = () => request<{ generation: number; generatedAt: number; games: GameCatalogEntry[] }>('/api/games/catalog');

export const fetchOfficialTemplate = (id: string, version: number | undefined, timeoutMs?: number) =>
  request<OfficialCatalogEntry & { payload: GameTemplate }>(
    `/api/official/template/${encodeURIComponent(id)}${version === undefined ? '' : `?version=${version}`}`,
    {},
    timeoutMs
  );

/** Every bundled official scoreboard of one language, served from a single D1 row. */
export const fetchOfficialPack = (lang: string) =>
  request<OfficialPackPayload>(`/api/official/pack?lang=${encodeURIComponent(lang)}`);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Admin calls carry this device's signed session (src/services/cloud/cloudSession.ts):
 * signing in once with Google keeps the owner signed in on this device. A stale
 * session or device key is dropped and replaced once, which may show Google's
 * sign-in when the caller allows it.
 */
const adminRequest = async <T>(path: string, init: RequestInit = {}, interactive = true): Promise<T> => {
  const method = (init.method ?? 'GET').toUpperCase();
  const body = typeof init.body === 'string' ? init.body : undefined;
  let sentToken: string | undefined;
  const send = async () => {
    const headers = new Headers(init.headers);
    const auth = await sessionHeaders(method, path, body, { interactive }).catch(error => {
      if (error instanceof CloudSessionError) throw new OfficialApiError(error.code, error.status);
      throw error;
    });
    sentToken = auth.authorization.slice('Bearer '.length);
    for (const [name, value] of Object.entries(auth)) headers.set(name, value);
    if (body) headers.set('content-type', 'application/json');
    return request<T>(path, { ...init, method, headers });
  };
  try {
    return await send();
  } catch (error) {
    if (error instanceof OfficialApiError && isStaleSessionError(error.code) && sentToken && clearCloudSessionIfTokenMatches(sentToken)) {
      return send();
    }
    throw error;
  }
};

/** Delete a user-shared scoreboard (owner only). */
export const deleteSharedTemplate = (id: string) =>
  adminRequest<{ success: boolean }>(`/api/template/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const fetchPublishTarget = (bggId: string, lang: string) =>
  adminRequest<OfficialPublishTarget>(
    `/api/admin/official/target?bggId=${encodeURIComponent(bggId)}&lang=${encodeURIComponent(lang)}`
  );

export const publishOfficialTemplate = (body: {
  bggId: string;
  lang: string;
  name: string;
  enName?: string;
  payload: unknown;
  bundled: boolean;
  /** Bundled built-in this publish takes over; the Worker keeps its ID. */
  builtinId?: string;
  expectedVersion: number;
}) => adminRequest<OfficialPublishResult>('/api/admin/official/publish', { method: 'POST', body: JSON.stringify(body) });

export interface BuiltinRegistration {
  id: string;
  bggId: string;
  lang: string;
  name: string;
  payload: unknown;
}

/** Store bundled built-ins as version 0; the Worker accepts at most 8 per request. */
export const registerBundledBuiltins = (items: BuiltinRegistration[]) =>
  adminRequest<{ registered: number; skipped: number; rejected: string[] }>('/api/admin/official/register-builtins', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });

export const updateOfficialSettings = (id: string, settings: { bundled?: boolean; enName?: string }) =>
  adminRequest<OfficialCatalogEntry>(`/api/admin/official/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });

export const fetchOfficialVersions = (id: string) =>
  adminRequest<OfficialCatalogEntry & { versions: OfficialVersionSummary[] }>(
    `/api/admin/official/${encodeURIComponent(id)}/versions`
  );

export const rollbackOfficialTemplate = (id: string, version: number, expectedVersion: number) =>
  adminRequest<{ id: string; version: number; restoredFrom: number }>(
    `/api/admin/official/${encodeURIComponent(id)}/rollback`,
    { method: 'POST', body: JSON.stringify({ version, expectedVersion }) }
  );

export const rebuildCatalogSnapshot = (kind: CatalogKind) =>
  adminRequest<{ rebuilt: boolean; generation: number; throughVersion: number }>(
    kind === 'games' ? '/api/admin/games/catalog/rebuild' : '/api/admin/share/catalog/rebuild',
    { method: 'POST' }
  );

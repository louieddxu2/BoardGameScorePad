/**
 * Worker API for official (cloud built-in) and shared scoreboard catalogs.
 * Public reads need no account; admin calls carry the Google access token.
 */
import { CLOUD_SHARE_BASE_URL } from '../../services/cloudClient';
import { googleAuth } from '../../services/cloud/googleAuth';
import type { GameTemplate } from '../../types';
import type {
  CatalogChangesPayload,
  CatalogKind,
  CatalogSnapshotPayload,
  OfficialCatalogEntry,
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

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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

const catalogPath = (kind: CatalogKind) => (kind === 'official' ? '/api/official/catalog' : '/api/share/catalog');

export const fetchCatalogSnapshot = <T extends OfficialCatalogEntry | ShareCatalogEntry>(kind: CatalogKind) =>
  request<CatalogSnapshotPayload<T>>(catalogPath(kind));

export const fetchCatalogChanges = <T extends OfficialCatalogEntry | ShareCatalogEntry>(kind: CatalogKind, after: number) =>
  request<CatalogChangesPayload<T>>(`${catalogPath(kind)}/changes?after=${after}`);

export const fetchOfficialTemplate = (id: string, version: number) =>
  request<OfficialCatalogEntry & { payload: GameTemplate }>(
    `/api/official/template/${encodeURIComponent(id)}?version=${version}`
  );

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Use the current Google token, signing in only when the caller allows it. */
const getAdminToken = async (interactive: boolean): Promise<string> => {
  if (googleAuth.isAuthorized && googleAuth.token) return googleAuth.token;
  if (!interactive) throw new OfficialApiError('not_signed_in', 401);
  return googleAuth.signIn();
};

const adminRequest = async <T>(path: string, init: RequestInit = {}, interactive = true): Promise<T> => {
  const token = await getAdminToken(interactive);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  return request<T>(path, { ...init, headers });
};

export const fetchAdminIdentity = (interactive: boolean) =>
  adminRequest<{ isAdmin: boolean; sub: string; email?: string }>('/api/admin/me', {}, interactive);

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
  expectedVersion: number;
}) => adminRequest<OfficialPublishResult>('/api/admin/official/publish', { method: 'POST', body: JSON.stringify(body) });

export const registerBundledBuiltins = (items: { id: string; bggId: string; lang: string; name: string }[]) =>
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
    kind === 'official' ? '/api/admin/official/catalog/rebuild' : '/api/admin/share/catalog/rebuild',
    { method: 'POST' }
  );

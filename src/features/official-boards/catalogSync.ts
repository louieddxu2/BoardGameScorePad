/**
 * Local-first catalog sync. The app always reads the local copy in IndexedDB.
 *
 * - Game catalog (every game, its official boards and rules): at most every 6 hours
 *   the app reads the cloud's generation (one D1 row) and downloads the whole
 *   snapshot (a few rows) only when it moved.
 * - Share catalog: changes after the local version at most every 6 hours, and the
 *   full snapshot weekly or when there is no local copy.
 * A manual refresh can force either step.
 */
import type { Table } from 'dexie';
import { db } from '../../db';
import { fetchCatalogChanges, fetchCatalogSnapshot, fetchGameCatalog, fetchGameCatalogVersion, OfficialApiError } from './officialApi';
import { toStoredGameEntry } from './gameCatalog';
import type { CatalogKind, CatalogSyncState, ShareCatalogEntry } from './types';

export const CHANGES_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SNAPSHOT_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHANGE_PAGES = 20;

export type CatalogSyncMode = 'auto' | 'changes' | 'snapshot';

export interface CatalogSyncResult {
  kind: CatalogKind;
  /** What actually ran: nothing (still fresh), changes only (or a version check), or a snapshot download. */
  ran: 'none' | 'changes' | 'snapshot';
  changed: number;
  state: CatalogSyncState;
}

const emptyState = (kind: CatalogKind): CatalogSyncState => ({
  kind,
  throughVersion: 0,
  generation: 0,
  snapshotAt: 0,
  checkedAt: 0,
});

export const getCatalogSyncState = async (kind: CatalogKind): Promise<CatalogSyncState> =>
  (await db.catalogSync.get(kind)) ?? emptyState(kind);

/** Game catalog: check the generation, then replace the local copy only when it moved. */
const runGamesSync = async (mode: CatalogSyncMode): Promise<CatalogSyncResult> => {
  const now = Date.now();
  const state = await getCatalogSyncState('games');
  const due = mode !== 'auto' || state.snapshotAt === 0 || now - state.checkedAt >= CHANGES_CHECK_INTERVAL_MS;
  if (!due) return { kind: 'games', ran: 'none', changed: 0, state };

  // Without a local copy there is nothing to compare: download right away.
  const remote = mode === 'snapshot' || state.snapshotAt === 0 ? null : await fetchGameCatalogVersion();
  if (remote && state.snapshotAt !== 0 && remote.generation === state.generation) {
    const next = { ...state, checkedAt: now };
    await db.catalogSync.put(next);
    return { kind: 'games', ran: 'changes', changed: 0, state: next };
  }

  const catalog = await fetchGameCatalog();
  await db.transaction('rw', db.gameCatalog, async () => {
    await db.gameCatalog.clear();
    if (catalog.games.length > 0) await db.gameCatalog.bulkPut(catalog.games.map(toStoredGameEntry));
  });
  const next: CatalogSyncState = {
    ...state, generation: catalog.generation, throughVersion: catalog.generation, snapshotAt: now, checkedAt: now,
  };
  await db.catalogSync.put(next);
  return { kind: 'games', ran: 'snapshot', changed: catalog.games.length, state: next };
};

/** Share catalog: apply change pages after `after` until caught up. */
const applyShareChanges = async (after: number): Promise<{ throughVersion: number; changed: number }> => {
  const table = db.shareCatalog as Table<ShareCatalogEntry>;
  let position = after;
  let changed = 0;
  for (let page = 0; page < MAX_CHANGE_PAGES; page++) {
    const result = await fetchCatalogChanges<ShareCatalogEntry>('share', position);
    if (result.changes.length > 0) {
      await db.transaction('rw', table, async () => {
        for (const change of result.changes) {
          if (change.deleted || !change.template) await table.delete(change.templateId);
          else await table.put(change.template);
        }
      });
      changed += result.changes.length;
    }
    position = result.throughVersion;
    if (!result.hasMore) break;
  }
  return { throughVersion: position, changed };
};

const runShareSync = async (mode: CatalogSyncMode): Promise<CatalogSyncResult> => {
  const now = Date.now();
  const state = await getCatalogSyncState('share');
  const needsSnapshot = mode === 'snapshot' || state.snapshotAt === 0 || now - state.snapshotAt >= SNAPSHOT_REFRESH_INTERVAL_MS;
  const needsChanges = needsSnapshot || mode === 'changes' || now - state.checkedAt >= CHANGES_CHECK_INTERVAL_MS;
  if (!needsChanges) return { kind: 'share', ran: 'none', changed: 0, state };

  let next: CatalogSyncState = { ...state };
  let changed = 0;
  if (needsSnapshot) {
    const snapshot = await fetchCatalogSnapshot<ShareCatalogEntry>('share');
    await db.transaction('rw', db.shareCatalog, async () => {
      await db.shareCatalog.clear();
      if (snapshot.templates.length > 0) await db.shareCatalog.bulkPut(snapshot.templates);
    });
    changed = snapshot.templates.length;
    next = { ...next, throughVersion: snapshot.throughVersion, generation: snapshot.generation, snapshotAt: now };
  }

  const applied = await applyShareChanges(next.throughVersion);
  next = { ...next, throughVersion: applied.throughVersion, checkedAt: Date.now() };
  await db.catalogSync.put(next);
  return { kind: 'share', ran: needsSnapshot ? 'snapshot' : 'changes', changed: changed + applied.changed, state: next };
};

const inFlight = new Map<CatalogKind, Promise<CatalogSyncResult>>();

/** Sync one catalog; concurrent callers share the same request. */
export const syncCatalog = (kind: CatalogKind, mode: CatalogSyncMode = 'auto'): Promise<CatalogSyncResult> => {
  const running = inFlight.get(kind);
  if (running && mode === 'auto') return running;
  const run = () => (kind === 'games' ? runGamesSync(mode) : runShareSync(mode));
  const task = (running ? running.catch(() => undefined) : Promise.resolve()).then(run);
  const tracked = task.finally(() => {
    if (inFlight.get(kind) === tracked) inFlight.delete(kind);
  });
  inFlight.set(kind, tracked);
  return tracked;
};

/** Background sync used on app start and reconnect. Reuse the game catalog result for the first-open pack check. */
export const syncGameCatalogInBackground = () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  return syncCatalog('games').catch((error) => {
    if (!(error instanceof OfficialApiError && error.code === 'cloud_data_disabled')) {
      console.warn('[catalog] game sync failed', error);
    }
    return null;
  });
};

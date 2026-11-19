/**
 * Local-first catalog sync (same rhythm as BoardGameHelper's game list):
 * - The app always reads the local copy in IndexedDB.
 * - Changes after the local version are checked at most every 10 minutes.
 * - The full snapshot is re-downloaded weekly, or when there is no local copy.
 * A manual refresh can force either step.
 */
import type { Table } from 'dexie';
import { db } from '../../db';
import { fetchCatalogChanges, fetchCatalogSnapshot } from './officialApi';
import type { CatalogKind, CatalogSyncState, OfficialCatalogEntry, ShareCatalogEntry } from './types';

export const CHANGES_CHECK_INTERVAL_MS = 10 * 60 * 1000;
export const SNAPSHOT_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHANGE_PAGES = 20;

export type CatalogSyncMode = 'auto' | 'changes' | 'snapshot';

export interface CatalogSyncResult {
  kind: CatalogKind;
  /** What actually ran: nothing (still fresh), changes only, or snapshot + changes. */
  ran: 'none' | 'changes' | 'snapshot';
  changed: number;
  state: CatalogSyncState;
}

type CatalogEntry = OfficialCatalogEntry | ShareCatalogEntry;

const tableFor = (kind: CatalogKind): Table<CatalogEntry> =>
  (kind === 'official' ? db.officialCatalog : db.shareCatalog) as Table<CatalogEntry>;

const emptyState = (kind: CatalogKind): CatalogSyncState => ({
  kind,
  throughVersion: 0,
  generation: 0,
  snapshotAt: 0,
  checkedAt: 0,
});

export const getCatalogSyncState = async (kind: CatalogKind): Promise<CatalogSyncState> =>
  (await db.catalogSync.get(kind)) ?? emptyState(kind);

/** Apply change pages after `after` until caught up; returns the new position and change count. */
const applyChanges = async (kind: CatalogKind, after: number): Promise<{ throughVersion: number; changed: number }> => {
  const table = tableFor(kind);
  let position = after;
  let changed = 0;
  for (let page = 0; page < MAX_CHANGE_PAGES; page++) {
    const result = await fetchCatalogChanges<CatalogEntry>(kind, position);
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

const runSync = async (kind: CatalogKind, mode: CatalogSyncMode): Promise<CatalogSyncResult> => {
  const now = Date.now();
  const state = await getCatalogSyncState(kind);
  const needsSnapshot = mode === 'snapshot' || state.snapshotAt === 0 || now - state.snapshotAt >= SNAPSHOT_REFRESH_INTERVAL_MS;
  const needsChanges = needsSnapshot || mode === 'changes' || now - state.checkedAt >= CHANGES_CHECK_INTERVAL_MS;
  if (!needsChanges) return { kind, ran: 'none', changed: 0, state };

  let next: CatalogSyncState = { ...state };
  let changed = 0;
  if (needsSnapshot) {
    const snapshot = await fetchCatalogSnapshot<CatalogEntry>(kind);
    const table = tableFor(kind);
    await db.transaction('rw', table, async () => {
      await table.clear();
      if (snapshot.templates.length > 0) await table.bulkPut(snapshot.templates);
    });
    changed = snapshot.templates.length;
    next = { ...next, throughVersion: snapshot.throughVersion, generation: snapshot.generation, snapshotAt: now };
  }

  const applied = await applyChanges(kind, next.throughVersion);
  next = { ...next, throughVersion: applied.throughVersion, checkedAt: Date.now() };
  await db.catalogSync.put(next);
  return { kind, ran: needsSnapshot ? 'snapshot' : 'changes', changed: changed + applied.changed, state: next };
};

const inFlight = new Map<CatalogKind, Promise<CatalogSyncResult>>();

/** Sync one catalog; concurrent callers share the same request. */
export const syncCatalog = (kind: CatalogKind, mode: CatalogSyncMode = 'auto'): Promise<CatalogSyncResult> => {
  const running = inFlight.get(kind);
  if (running && mode === 'auto') return running;
  const task = (running ? running.catch(() => undefined) : Promise.resolve()).then(() => runSync(kind, mode));
  const tracked = task.finally(() => {
    if (inFlight.get(kind) === tracked) inFlight.delete(kind);
  });
  inFlight.set(kind, tracked);
  return tracked;
};

/** Background sync used on app start and when the device comes back online. */
export const syncCatalogsInBackground = () => {
  // Unit tests drive sync explicitly and must not reach the network on app start.
  if (import.meta.env.MODE === 'test') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  (['official', 'share'] as CatalogKind[]).forEach((kind) => {
    syncCatalog(kind).catch((error) => console.warn(`[catalog] ${kind} sync failed`, error));
  });
};

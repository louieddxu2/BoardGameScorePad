/**
 * Local handling of official (cloud built-in) scoreboards.
 *
 * A downloaded official version is written into `builtins` under its stable
 * Built-in-* ID, so library, start panel, shadows and share links keep working
 * unchanged. Every downloaded version is also kept in `officialVersions`:
 * sessions resume on the version they started with, and a rebuild of the
 * bundled built-ins reapplies newer downloads.
 */
import { db } from '../../db';
import type { GameTemplate } from '../../types';
import { migrateTemplate } from '../../utils/dataMigration';
import { fetchOfficialTemplate } from './officialApi';
import type { OfficialCatalogEntry } from './types';

export const isOfficialTemplateId = (id: string | undefined): id is string => !!id && id.startsWith('Built-in-');

/** Local version of an official board: its downloaded version, 0 for the bundled copy, -1 when absent. */
export const localOfficialVersion = (template: Pick<GameTemplate, 'officialVersion'> | undefined | null): number =>
  template ? template.officialVersion ?? 0 : -1;

/**
 * How long starting or resuming a game waits for a download before using the
 * local copy. A slow or unresponsive Worker must not hold the player up.
 */
export const START_DOWNLOAD_TIMEOUT_MS = 4000;

/** Turn downloaded official content into the local template for that ID and version. */
export const toOfficialTemplate = (
  source: { payload: unknown; name: string; bggId: string },
  id: string,
  version: number,
  existing: GameTemplate | undefined,
  now: number
): GameTemplate =>
  migrateTemplate({
    ...(source.payload as GameTemplate),
    id,
    name: source.name,
    bggId: source.bggId,
    officialVersion: version,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

/** Download one published version and store it. Optionally make it the local copy in `builtins`. */
export const downloadOfficialVersion = async (
  id: string,
  version: number,
  options: { install: boolean; timeoutMs?: number }
): Promise<GameTemplate> => {
  const response = await fetchOfficialTemplate(id, version, options.timeoutMs);
  const now = Date.now();
  const existing = await db.builtins.get(id);
  const template = toOfficialTemplate(response, id, version, existing, now);
  await db.transaction('rw', db.officialVersions, db.builtins, async () => {
    await db.officialVersions.put({ id, version, template, downloadedAt: now });
    if (!options.install) return;
    // Never replace a newer local copy with an older download.
    const current = await db.builtins.get(id);
    if (localOfficialVersion(current) < version) await db.builtins.put(template);
  });
  return template;
};

export type EnsureOfficialResult =
  | { status: 'ready'; template: GameTemplate; downloaded: boolean }
  | { status: 'fallback'; template: GameTemplate; error: unknown }
  | { status: 'unavailable'; error: unknown };

/**
 * Make sure the catalog's version of an official board is local before starting.
 * Falls back to an older local copy when the download fails.
 */
export const ensureOfficialBoard = async (id: string, timeoutMs = START_DOWNLOAD_TIMEOUT_MS): Promise<EnsureOfficialResult> => {
  const [entry, local] = await Promise.all([db.officialCatalog.get(id), db.builtins.get(id)]);
  const localVersion = localOfficialVersion(local);
  if (!entry || entry.version <= localVersion) {
    return local ? { status: 'ready', template: local, downloaded: false } : { status: 'unavailable', error: new Error('not_in_catalog') };
  }
  try {
    const template = await downloadOfficialVersion(id, entry.version, { install: true, timeoutMs });
    return { status: 'ready', template, downloaded: true };
  } catch (error) {
    return local ? { status: 'fallback', template: local, error } : { status: 'unavailable', error };
  }
};

/** The bundled (version 0) content of a built-in, straight from the app's data files. */
const loadBundledTemplate = async (id: string): Promise<GameTemplate | null> => {
  const source = id.startsWith('Built-in-EN-')
    ? (await import('../../data/templates-en')).DEFAULT_TEMPLATES_EN
    : (await import('../../data/templates')).DEFAULT_TEMPLATES;
  return (source as GameTemplate[]).find((t) => t.id === id) ?? null;
};

/**
 * Content of an official board at a specific version, for resuming a session.
 * Returns null when that version is neither stored nor downloadable.
 */
export const getOfficialTemplateAtVersion = async (id: string, version: number): Promise<GameTemplate | null> => {
  const current = await db.builtins.get(id);
  if (current && localOfficialVersion(current) === version) return current;
  // Stored first: a version 0 installed from the cloud may not be in this app's bundle.
  const stored = await db.officialVersions.get([id, version]);
  if (stored) return stored.template;
  if (version === 0) return loadBundledTemplate(id);
  try {
    return await downloadOfficialVersion(id, version, { install: false, timeoutMs: START_DOWNLOAD_TIMEOUT_MS });
  } catch {
    return null;
  }
};

/** After `builtins` is rebuilt from bundled data, put back newer downloaded versions. */
export const reapplyDownloadedOfficialVersions = async (): Promise<number> => {
  const records = await db.officialVersions.toArray();
  const latest = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const previous = latest.get(record.id);
    if (!previous || record.version > previous.version) latest.set(record.id, record);
  }
  let restored = 0;
  await db.transaction('rw', db.builtins, async () => {
    for (const record of latest.values()) {
      const current = await db.builtins.get(record.id);
      if (localOfficialVersion(current) < record.version) {
        await db.builtins.put(record.template);
        restored++;
      }
    }
  });
  return restored;
};

export type OfficialLaunchState = 'needs_download' | 'update_available';

/** Compare the catalog with local copies; only boards that need the network are returned. */
export const computeOfficialLaunchStates = (
  catalog: OfficialCatalogEntry[],
  localVersions: Map<string, number>
): Map<string, OfficialLaunchState> => {
  const states = new Map<string, OfficialLaunchState>();
  for (const entry of catalog) {
    const local = localVersions.get(entry.id) ?? -1;
    if (entry.version <= local) continue;
    states.set(entry.id, local < 0 ? 'needs_download' : 'update_available');
  }
  return states;
};

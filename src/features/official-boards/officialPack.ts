/**
 * First-open install of official built-in scoreboards from the cloud.
 *
 * The Worker keeps one D1 row per language with the latest content of every
 * bundled official scoreboard. On first open in a language, the already synced
 * catalog tells us whether that row is needed. The app's own boards are
 * available immediately, including when the cloud cannot be reached.
 */
import { db } from '../../db';
import { getInstalledBundledOfficialCatalogVersion } from '../../utils/dbMigration';
import { fetchOfficialPack } from './officialApi';
import { archiveOfficialVersion, isOfficialTemplateId, localOfficialVersion, pruneOfficialVersions, toOfficialTemplate } from './officialBoards';

export type OfficialPackLang = 'zh-TW' | 'en';

const PACK_STATE_KEY = (lang: OfficialPackLang) => `sm_official_pack_installed_${lang}`;

export const packLangOf = (appLangCode: string): OfficialPackLang => (appLangCode.startsWith('en') ? 'en' : 'zh-TW');

const readInstalled = (lang: OfficialPackLang): boolean => {
  try {
    return localStorage.getItem(PACK_STATE_KEY(lang)) !== null;
  } catch {
    return false;
  }
};

const markInstalled = (lang: OfficialPackLang, throughVersion: number) => {
  try {
    localStorage.setItem(PACK_STATE_KEY(lang), String(throughVersion));
  } catch {
    // Without storage the next open runs the version check again.
  }
};

/**
 * On first open, fetch the language's pack only when a bundled board is behind
 * or missing. Returns the number of boards written, or null after the first check.
 */
export const installOfficialPack = async (lang: OfficialPackLang, catalogVersion: number): Promise<number | null> => {
  if (readInstalled(lang)) return null;
  if (catalogVersion === getInstalledBundledOfficialCatalogVersion()) {
    markInstalled(lang, catalogVersion);
    return 0;
  }

  const entries = (await db.officialCatalog.toArray()).filter(entry =>
    entry.bundled && entry.lang === lang && isOfficialTemplateId(entry.id)
  );
  const localBoards = await db.builtins.bulkGet(entries.map(entry => entry.id));
  if (!entries.some((entry, index) => entry.version > localOfficialVersion(localBoards[index]))) {
    markInstalled(lang, catalogVersion);
    return 0;
  }

  const pack = await fetchOfficialPack(lang);
  const now = Date.now();
  let installed = 0;
  await db.transaction('rw', db.builtins, db.officialVersions, db.sessions, async () => {
    for (const item of pack.templates) {
      if (!isOfficialTemplateId(item.id) || typeof item.version !== 'number') continue;
      const current = await db.builtins.get(item.id);
      // The bundled copy is version 0; only newer or missing boards are written.
      if (localOfficialVersion(current) >= item.version) continue;
      const template = toOfficialTemplate(item, item.id, item.version, current, now);
      if (current) await archiveOfficialVersion(current);
      // Kept in officialVersions too, so a rebuild of the bundled built-ins puts it back.
      await db.officialVersions.put({ id: item.id, version: item.version, template, downloadedAt: now });
      await db.builtins.put(template);
      installed++;
    }
    if (installed) await pruneOfficialVersions();
  });
  markInstalled(lang, pack.throughVersion);
  return installed;
};

const inFlight = new Map<OfficialPackLang, Promise<number | null>>();

/** Run the first-open install without blocking the app; failures are retried on a later open. */
export const installOfficialPackInBackground = (appLangCode: string, catalogVersion: number) => {
  const lang = packLangOf(appLangCode);
  if (inFlight.has(lang) || readInstalled(lang)) return;
  const task = installOfficialPack(lang, catalogVersion)
    .catch((error) => {
      console.warn(`[official] ${lang} pack install failed; using the bundled scoreboards`, error);
      return null;
    })
    .finally(() => inFlight.delete(lang));
  inFlight.set(lang, task);
};

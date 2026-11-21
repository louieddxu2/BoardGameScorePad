/**
 * First-open install of official built-in scoreboards from the cloud.
 *
 * The Worker keeps one D1 row per language with the latest content of every
 * bundled official scoreboard. The first time the app opens in a language it
 * downloads that row once and installs every board newer than the local copy,
 * including boards the app bundle does not ship. The scoreboards bundled with
 * the app stay as the fallback: when the cloud is slow or down, they are
 * already in place and the download is retried on a later open.
 */
import { db } from '../../db';
import { fetchOfficialPack } from './officialApi';
import { archiveOfficialVersion, isOfficialTemplateId, localOfficialVersion, toOfficialTemplate } from './officialBoards';

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
    // Without storage the pack is fetched again on the next open: one row read.
  }
};

/**
 * Install the language's pack once. Returns the number of boards written, or
 * null when it was already installed. Throws when the download fails.
 */
export const installOfficialPack = async (lang: OfficialPackLang): Promise<number | null> => {
  if (readInstalled(lang)) return null;
  const pack = await fetchOfficialPack(lang);
  const now = Date.now();
  let installed = 0;
  await db.transaction('rw', db.builtins, db.officialVersions, async () => {
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
  });
  markInstalled(lang, pack.throughVersion);
  return installed;
};

const inFlight = new Map<OfficialPackLang, Promise<number | null>>();

/** Run the first-open install without blocking the app; failures are retried on a later open. */
export const installOfficialPackInBackground = (appLangCode: string) => {
  // Unit tests drive installs explicitly and must not reach the network on app start.
  if (import.meta.env.MODE === 'test') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const lang = packLangOf(appLangCode);
  if (inFlight.has(lang) || readInstalled(lang)) return;
  const task = installOfficialPack(lang)
    .catch((error) => {
      console.warn(`[official] ${lang} pack install failed; using the bundled scoreboards`, error);
      return null;
    })
    .finally(() => inFlight.delete(lang));
  inFlight.set(lang, task);
};

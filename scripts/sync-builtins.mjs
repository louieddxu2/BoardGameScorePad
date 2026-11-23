#!/usr/bin/env node
/**
 * npm run sync:builtins — copy the cloud's bundled official scoreboards into
 * src/data/templates.ts and templates-en.ts. Run before merging into main.
 *
 * Reads the public content packs (one D1 row per language) and the catalog
 * changes since they were built. Stops without writing when a bundled board
 * changed after the last pack rebuild (press "Rebuild official catalog
 * snapshot" in the admin card first). Catalog changes are per game (BGG ID). Records the verified catalog version
 * and raises the built-in data version when scoreboard content changes.
 *
 * Options: --check (report only; exit 1 when the bundle is behind).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { bumpBuiltinVersion, planSync, renderDataFile, setBundledCatalogVersion, splitDataFile, staleBundledChanges } from './builtin-sync-lib.mjs';

const FILES = { 'zh-TW': 'src/data/templates.ts', en: 'src/data/templates-en.ts' };
const MIGRATION = 'src/utils/dbMigration.ts';
const checkOnly = process.argv.includes('--check');

const baseUrl = (() => {
  if (process.env.VITE_TEMPLATE_SHARE_API_BASE_URL) return process.env.VITE_TEMPLATE_SHARE_API_BASE_URL.replace(/\/$/, '');
  const match = /CLOUD_SHARE_BASE_URL\s*=.*?'(https:\/\/[^']+)'/.exec(readFileSync('src/services/cloudClient.ts', 'utf8'));
  if (!match) throw new Error('Cloud API URL not found in src/services/cloudClient.ts');
  return match[1];
})();

const getJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${body?.error || `HTTP ${response.status}`}`);
  return body;
};

/** Stage all writes before changing tracked files. Restore replaced files if a rename fails. */
const replaceFiles = (updates) => {
  const tag = randomUUID();
  const staged = [];
  const replaced = [];
  const recovery = new Set();
  try {
    for (const { file, before, after } of updates) {
      const entry = { file, next: `${file}.${tag}.tmp`, backup: `${file}.${tag}.bak` };
      staged.push(entry);
      writeFileSync(entry.backup, before, { flag: 'wx' });
      writeFileSync(entry.next, after, { flag: 'wx' });
    }
    for (const entry of staged) {
      renameSync(entry.next, entry.file);
      replaced.push(entry);
    }
  } catch (error) {
    const failures = [];
    for (const { backup, file } of replaced.reverse()) {
      try {
        renameSync(backup, file);
      } catch (rollbackError) {
        recovery.add(backup);
        failures.push(rollbackError);
      }
    }
    if (failures.length) throw new AggregateError([error, ...failures], `Restore from backups: ${[...recovery].join(', ')}`);
    throw error;
  } finally {
    for (const { next, backup } of staged) {
      rmSync(next, { force: true });
      if (!recovery.has(backup)) rmSync(backup, { force: true });
    }
  }
};

const packs = {};
for (const lang of Object.keys(FILES)) packs[lang] = await getJson(`/api/official/pack?lang=${encodeURIComponent(lang)}`);

// Stop if a board has changed or is still in a pack after being excluded.
let after = Math.min(...Object.values(packs).map((p) => p.throughVersion));
const changes = [];
for (;;) {
  const page = await getJson(`/api/games/catalog/changes?after=${after}`);
  changes.push(...page.changes);
  after = page.throughVersion;
  if (!page.hasMore) break;
}
const stale = staleBundledChanges(changes, packs);
if (stale.length) {
  console.error(`The content packs are older than these bundled boards: ${[...new Set(stale)].join(', ')}`);
  console.error('Rebuild the game catalog snapshot in the admin card (cloud built-in tab), then run this again.');
  process.exit(2);
}

const now = Date.now();
const updates = [];
for (const [lang, file] of Object.entries(FILES)) {
  const isEnglish = lang === 'en';
  const items = packs[lang].templates.filter((t) => t.id.startsWith('Built-in-EN-') === isEnglish);
  const before = readFileSync(file, 'utf8');
  const parts = splitDataFile(before);
  const plan = planSync(parts.entries, items, now);
  for (const u of plan.updated) console.log(`${lang}: ${u.id} v${u.from} -> v${u.to}`);
  for (const a of plan.added) console.log(`${lang}: ${a.id} added (v${a.version})`);
  if (plan.notInPack.length) console.log(`${lang}: kept, not marked bundled in the cloud: ${plan.notInPack.join(', ')}`);
  if (plan.updated.length || plan.added.length) {
    updates.push({ file, before, after: renderDataFile({ ...parts, entries: plan.entries }) });
  }
}

if (checkOnly && updates.length) {
  console.log('The bundle is behind the cloud (nothing written: --check).');
  process.exit(1);
}
if (!updates.length) console.log('Bundled scoreboards already match the cloud.');
if (!checkOnly) {
  const before = readFileSync(MIGRATION, 'utf8');
  const bump = updates.length ? bumpBuiltinVersion(before) : null;
  const migration = setBundledCatalogVersion(bump?.text ?? before, after);
  if (migration !== before) {
    replaceFiles([...updates, { file: MIGRATION, before, after: migration }]);
    if (bump) console.log(`Built-in data version ${bump.from} -> ${bump.to}.`);
    console.log(`Bundled catalog version: ${after}. Review and commit the changes.`);
  }
}

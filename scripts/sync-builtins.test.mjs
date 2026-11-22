import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const entryFile = resolve('scripts/sync-builtins.mjs');
const zhFile = 'src/data/templates.ts';
const enFile = 'src/data/templates-en.ts';
const migrationFile = 'src/utils/dbMigration.ts';
const empty = 'export const DEFAULT_TEMPLATES: GameTemplate[] = [];\n';
const migration = 'const CURRENT_BUILTIN_VERSION = 23;\nconst BUNDLED_OFFICIAL_CATALOG_VERSION: number | null = null;\n';
const directories = [];

const fixture = (overrides = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'scorepad-sync-test-'));
  directories.push(root);
  mkdirSync(join(root, 'src/data'), { recursive: true });
  mkdirSync(join(root, 'src/utils'), { recursive: true });
  const initial = { [zhFile]: empty, [enFile]: empty, [migrationFile]: migration, ...overrides };
  for (const [file, contents] of Object.entries(initial)) writeFileSync(join(root, file), contents);
  return { root, initial };
};

const runSync = (root, { changes = [], failRename = false } = {}) => {
  const bootstrap = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const changes = ${JSON.stringify(changes)};
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (!url.pathname.endsWith('/pack')) {
        return Response.json({ throughVersion: 8, hasMore: false, changes });
      }
      const id = url.searchParams.get('lang') === 'en' ? 'Built-in-EN-Fixture' : 'Built-in-Fixture';
      const board = { id, name: 'Fixture', bggId: '1', version: 1, payload: { columns: [{ id: 'score', name: 'Score' }] } };
      return Response.json({ throughVersion: 7, templates: [board] });
    };
    if (${failRename}) {
      const rename = fs.renameSync;
      fs.renameSync = (from, to) => {
        if (String(from).endsWith('.tmp') && to === '${migrationFile}') throw new Error('simulated_rename_failure');
        rename(from, to);
      };
      syncBuiltinESMExports();
    }
  `;
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(bootstrap)}`, entryFile], {
    cwd: root,
    env: { ...process.env, VITE_TEMPLATE_SHARE_API_BASE_URL: 'https://unused.invalid' },
    encoding: 'utf8',
  });
};

const expectUnchanged = ({ root, initial }) => {
  for (const [file, contents] of Object.entries(initial)) {
    expect(readFileSync(join(root, file), 'utf8')).toBe(contents);
  }
  expect(readdirSync(join(root, 'src/data')).sort()).toEqual(['templates-en.ts', 'templates.ts']);
  expect(readdirSync(join(root, 'src/utils'))).toEqual(['dbMigration.ts']);
};

describe('sync:builtins command', () => {
  afterEach(() => {
    for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('stops before copying a board that was removed from a stale pack', () => {
    const files = fixture();
    const result = runSync(files.root, { changes: [
      { templateId: 'Built-in-Fixture', catalogVersion: 8, template: { lang: 'zh-TW', bundled: false } },
    ] });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Built-in-Fixture');
    expectUnchanged(files);
  });

  it.each([enFile, migrationFile])('prepares all files before writing when %s fails validation', (file) => {
    const files = fixture({ [file]: 'Not a valid source file' });
    const result = runSync(files.root);
    expect(result.status).toBe(1);
    expectUnchanged(files);
  });

  it('rolls both data files back if replacing the migration file fails', () => {
    const files = fixture();
    const result = runSync(files.root, { failRename: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('simulated_rename_failure');
    expectUnchanged(files);
  });

  it('writes both data files and bumps the version once on success', () => {
    const { root } = fixture();
    const result = runSync(root);
    expect(result.status).toBe(0);
    expect(readFileSync(join(root, zhFile), 'utf8')).toContain('Built-in-Fixture');
    expect(readFileSync(join(root, enFile), 'utf8')).toContain('Built-in-EN-Fixture');
    expect(readFileSync(join(root, migrationFile), 'utf8')).toBe(migration.replace('= 23;', '= 24;').replace('= null;', '= 8;'));
  });

  it('records the verified catalog version without raising the data version if boards already match', () => {
    const seeded = (id) => empty.replace('[];', `[${JSON.stringify({ id, officialVersion: 1 })}];`);
    const { root, initial } = fixture({
      [zhFile]: seeded('Built-in-Fixture'),
      [enFile]: seeded('Built-in-EN-Fixture'),
    });
    const result = runSync(root);
    expect(result.status).toBe(0);
    expect(readFileSync(join(root, zhFile), 'utf8')).toBe(initial[zhFile]);
    expect(readFileSync(join(root, enFile), 'utf8')).toBe(initial[enFile]);
    expect(readFileSync(join(root, migrationFile), 'utf8')).toBe(migration.replace('= null;', '= 8;'));
  });
});

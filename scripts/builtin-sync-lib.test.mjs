import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bumpBuiltinVersion, formatEntry, planSync, renderDataFile, splitDataFile, staleBundledChanges } from './builtin-sync-lib.mjs';

const file = (entries) =>
  `// @ts-nocheck\nimport { GameTemplate } from './types';\n\nexport const DEFAULT_TEMPLATES: GameTemplate[] =\n  [\n${entries.map((e) => `    ${formatEntry(e)}`).join(',\n')}\n  ];\n`;

const item = (id, version, columns, extra = {}) => ({ id, bggId: '1', name: id, version, payload: { name: id, columns: columns.map((n) => ({ id: n, name: n })), ...extra } });

describe('bundled scoreboard sync', () => {
  it('writes the real data files back byte for byte when nothing changes', () => {
    for (const path of ['src/data/templates.ts', 'src/data/templates-en.ts']) {
      const text = readFileSync(path, 'utf8');
      const parts = splitDataFile(text);
      const roundTrips = renderDataFile({ ...parts, entries: planSync(parts.entries, []).entries }) === text;
      expect(roundTrips, `Round-trip changed ${path}`).toBe(true);
    }
  });

  it('updates boards the cloud holds newer, adds missing ones in ID order, and leaves the rest untouched', () => {
    const text = file([
      { id: 'Built-in-A', name: 'A', columns: [], createdAt: 5, hasImage: false, lastPlayerCount: 4 },
      { id: 'Built-in-C', name: 'C', columns: [], createdAt: 6, officialVersion: 2 },
    ]);
    const parts = splitDataFile(text);
    const plan = planSync(parts.entries, [item('Built-in-A', 3, ['x']), item('Built-in-B', 0, ['y']), item('Built-in-C', 2, ['z'])], 100);
    expect(plan.updated).toEqual([{ id: 'Built-in-A', from: 0, to: 3 }]);
    expect(plan.added).toEqual([{ id: 'Built-in-B', version: 0 }]);
    const out = splitDataFile(renderDataFile({ ...parts, entries: plan.entries }));
    expect(out.entries.map((e) => e.value.id)).toEqual(['Built-in-A', 'Built-in-B', 'Built-in-C']);
    // The updated board records its version and keeps what only the bundle knew.
    expect(out.entries[0].value).toMatchObject({ officialVersion: 3, createdAt: 5, hasImage: false, lastPlayerCount: 4, updatedAt: 100 });
    expect(out.entries[0].value.columns.map((c) => c.name)).toEqual(['x']);
    // A version 0 board records no version (the app counts none as 0); C was already current.
    expect(out.entries[1].value.officialVersion).toBeUndefined();
    expect(out.entries[2].source).toBe(parts.entries[1].source);
  });

  it('keeps bundled boards the cloud no longer bundles, and reports them', () => {
    const parts = splitDataFile(file([{ id: 'Built-in-Old', name: 'Old', columns: [], createdAt: 1 }]));
    const plan = planSync(parts.entries, []);
    expect(plan.notInPack).toEqual(['Built-in-Old']);
    expect(plan.entries).toHaveLength(1);
  });

  it('raises the built-in data version by one', () => {
    expect(bumpBuiltinVersion('x\nconst CURRENT_BUILTIN_VERSION = 23;\ny')).toEqual({ text: 'x\nconst CURRENT_BUILTIN_VERSION = 24;\ny', from: 23, to: 24 });
  });

  it('detects later bundled changes and boards that became cloud-only after packing', () => {
    const packs = {
      'zh-TW': { throughVersion: 5, templates: [{ id: 'Built-in-B', bggId: '2', version: 1 }, { id: 'Built-in-C', bggId: '3', version: 0 }] },
      en: { throughVersion: 8, templates: [{ id: 'Built-in-EN-D', bggId: '4', version: 3 }] },
    };
    // Each change is one game of the game catalog (templateId = BGG ID) with all its boards.
    const game = (bggId, boards, extra = {}) => ({ templateId: bggId, catalogVersion: 6, template: { bggId, boards, ...extra } });
    expect(
      staleBundledChanges([
        game('1', [{ id: 'Built-in-A', lang: 'zh-TW', bundled: true, version: 1 }]),
        game('2', [{ id: 'Built-in-B', lang: 'zh-TW', bundled: false, version: 1 }]),
        { templateId: '3', catalogVersion: 6, deleted: true },
        // Only the rules changed: its board is still the packed version.
        game('4', [{ id: 'Built-in-EN-D', lang: 'en', bundled: true, version: 3 }], { rules: [{ gameId: 'g', ruleGameId: 'g', publishedRuleCount: 2 }] }),
        game('5', [{ id: 'Built-in-E', lang: 'zh-TW', bundled: false, version: 1 }]),
      ], packs)
    ).toEqual(['Built-in-A', 'Built-in-B', 'Built-in-C']);
  });

  it('reports invalid entries without including any scoreboard content', () => {
    expect(() => splitDataFile('export const DEFAULT_TEMPLATES: GameTemplate[] = [{ "Fixture data" }]'))
      .toThrow(/^invalid_builtin_entry_json_at_offset_\d+$/);
  });
});

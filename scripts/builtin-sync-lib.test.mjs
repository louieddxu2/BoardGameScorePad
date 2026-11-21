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
      expect(renderDataFile({ ...parts, entries: planSync(parts.entries, []).entries })).toBe(text);
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

  it('treats changes to bundled boards after the pack as a stale pack', () => {
    expect(
      staleBundledChanges([
        { templateId: 'Built-in-A', deleted: false, template: { bundled: true } },
        { templateId: 'Built-in-B', deleted: false, template: { bundled: false } },
        { templateId: 'Built-in-C', deleted: true },
      ])
    ).toEqual(['Built-in-A', 'Built-in-C']);
  });
});

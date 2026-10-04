import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate } from '../../../types';
import { buildTemplateFromTextureMap } from './templateBuilder';

afterEach(() => vi.unstubAllGlobals());

const build = (mapping: boolean, imported: GameTemplate | null = null) =>
  buildTemplateFromTextureMap(
    'Example', mapping, imported, 2, mapping ? [['existing-column'], []] : [], 1, 3, 1,
    [0, 25, 50, 75, 100], [0, 50, 100], 1000, 1000,
    { top: 0, bottom: 100, left: 0, right: 100 }, 1,
    'Slot {n}', 'Item {n}',
  );

describe('texture template IDs on older browsers', () => {
  it('creates a template and distinct score column IDs without randomUUID', () => {
    vi.stubGlobal('crypto', {});
    const template = build(false);
    const ids = [template.id, ...template.columns.map(column => column.id)];
    expect(new Set(ids).size).toBe(3);
    expect(ids.every(id => /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id))).toBe(true);
    expect(template.columns.map(column => column.name)).toEqual(['Item 1', 'Item 2']);
  });

  it('preserves imported column IDs while creating a hidden placeholder', () => {
    vi.stubGlobal('crypto', {});
    const imported: GameTemplate = {
      id: 'existing-template', name: 'Imported', createdAt: 0,
      columns: [{ id: 'existing-column', name: 'Score', formula: 'a1', inputType: 'keypad', isScoring: true }],
    };
    const template = build(true, imported);
    expect(template.columns[0].id).toBe('existing-column');
    expect(template.columns[1]).toMatchObject({ name: 'Slot 2', displayMode: 'hidden' });
    expect(template.columns[1].id).not.toBe('existing-column');
    expect(template.columns[1].id).toHaveLength(36);
  });
});

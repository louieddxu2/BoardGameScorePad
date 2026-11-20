import { describe, expect, it } from 'vitest';
import { extractBggGameSummary } from '../../utils/extractDataSummaries';
import { mergeOfficialGameInfo } from './officialGameInfo';
import type { OfficialCatalogEntry } from './types';

const entry = (bggId: string, lang: string, name: string, extra: Partial<OfficialCatalogEntry> = {}): OfficialCatalogEntry => ({
  id: `Built-in-${bggId}-${lang}`,
  bggId,
  lang,
  name,
  version: 0,
  bundled: true,
  updatedAt: 1,
  ...extra,
});

describe('official game names', () => {
  it('keeps the local dictionary and adds the rules names and every board name', () => {
    const local = [extractBggGameSummary({ id: '1', name: 'Concordia', altNames: ['康考迪婭'], minPlayers: 2, updatedAt: 1 })];
    const merged = mergeOfficialGameInfo(local, [
      entry('1', 'zh-TW', '康考迪婭', { game: { name: 'Concordia', altNames: ['和諧羅馬'] } }),
      entry('1', 'en', 'Concordia: Venus'),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: 'Concordia', minPlayers: 2, altNames: ['康考迪婭', '和諧羅馬', 'Concordia: Venus'] });
  });

  it('adds games the dictionary lacks, named by the rules site or else a board name in Latin letters', () => {
    const merged = mergeOfficialGameInfo([], [
      entry('2', 'zh-TW', '展翅翱翔', { game: { name: 'Wingspan', altNames: ['展翅翱翔'] } }),
      // No rules names: the English board's name, then the English name field, are the candidates.
      entry('3', 'zh-TW', '雅典衛城'),
      entry('3', 'en', 'Akropolis'),
      entry('4', 'zh-TW', '羽光', { enName: 'Featherlight' }),
      entry('5', 'zh-TW', '築夢頌'),
    ]);
    expect(merged.map((g) => [g.id, g.name, g.altNames])).toEqual([
      ['2', 'Wingspan', ['展翅翱翔']],
      ['3', 'Akropolis', ['雅典衛城']],
      ['4', 'Featherlight', ['羽光']],
      ['5', '築夢頌', []],
    ]);
  });

  it('returns the same array when the catalog adds nothing', () => {
    const local = [extractBggGameSummary({ id: '1', name: 'Concordia', altNames: ['康考迪婭'], updatedAt: 1 })];
    expect(mergeOfficialGameInfo(local, [entry('1', 'zh-TW', '康考迪婭', { game: { altNames: ['康考迪婭'] } })])).toBe(local);
    expect(mergeOfficialGameInfo(local, [])).toBe(local);
  });
});

import { describe, expect, it } from 'vitest';
import { extractBggGameSummary } from '../../utils/extractDataSummaries';
import { mergeOfficialGameInfo, toOfficialGameInfo } from './officialGameInfo';
import type { OfficialCatalogEntry } from './types';

const entry = (bggId: string, game: OfficialCatalogEntry['game'], lang = 'zh-TW'): OfficialCatalogEntry => ({
  id: `Built-in-${bggId}-${lang}`, bggId, lang, name: 'x', version: 0, bundled: true, updatedAt: 1, game,
});

describe('official game info', () => {
  it('keeps the local dictionary, adds only new aliases, and adds games it lacks', () => {
    const local = [extractBggGameSummary({ id: '1', name: 'Concordia', altNames: ['康考迪婭'], minPlayers: 2, updatedAt: 1 })];
    const merged = mergeOfficialGameInfo(local, [
      entry('1', { name: 'Concordia Venus', altNames: ['和諧羅馬', '康考迪婭'], minPlayers: 3 }),
      entry('1', { name: 'ignored second language copy' }, 'en'),
      entry('2', { name: 'Wingspan', altNames: ['展翅翱翔'], maxPlayers: 5 }),
      entry('3', null),
    ]);
    expect(merged[0]).toMatchObject({ name: 'Concordia', minPlayers: 2, altNames: ['康考迪婭', 'Concordia Venus', '和諧羅馬'] });
    expect(merged[1]).toMatchObject({ id: '2', name: 'Wingspan', altNames: ['展翅翱翔'], maxPlayers: 5 });
    expect(merged).toHaveLength(2);
  });

  it('returns the same array when the catalog adds nothing', () => {
    const local = [extractBggGameSummary({ id: '1', name: 'Concordia', altNames: ['康考迪婭'], updatedAt: 1 })];
    expect(mergeOfficialGameInfo(local, [entry('1', { altNames: ['康考迪婭'] })])).toBe(local);
    expect(mergeOfficialGameInfo(local, [])).toBe(local);
  });

  it('does not send local-only or volatile fields', () => {
    expect(toOfficialGameInfo({ id: '1', name: 'A', rank: 3, rating: 7.1, updatedAt: 5, altNames: ['甲'] })).toEqual({ name: 'A', altNames: ['甲'] });
  });
});

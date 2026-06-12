import { describe, expect, it } from 'vitest';
import {
  extractSessionContextWeights,
  getSessionContextWeightUpdates,
  mergeBggGames,
  mergeTemplatePrefs,
  mergeSessionContextWeights
} from './systemBackupMerge';
import {
  COUNT_WEIGHTS_ID,
  LOCATION_WEIGHTS_ID,
  PLAYER_WEIGHTS_ID
} from '../features/recommendation/WeightAdjustmentEngine';
import { BggGame, TemplatePreference, SystemWeightConfig } from '../types';

describe('systemBackupMerge', () => {
  it('uses newer BGG dictionary entries when both sides have updatedAt', () => {
    const local: BggGame[] = [{ id: '1', name: 'Local Old', updatedAt: 100 }];
    const cloud: BggGame[] = [{ id: '1', name: 'Cloud New', updatedAt: 200 }];

    expect(mergeBggGames(local, cloud)).toEqual([{ id: '1', name: 'Cloud New', updatedAt: 200 }]);
  });

  it('does not overwrite local BGG dictionary entries when cloud has no reliable updatedAt', () => {
    const local: BggGame[] = [{ id: '1', name: 'Local', updatedAt: 100 }];
    const cloud = [{ id: '1', name: 'Cloud Without Timestamp' }] as BggGame[];

    expect(mergeBggGames(local, cloud)).toEqual([{ id: '1', name: 'Local', updatedAt: 100 }]);
  });

  it('fills missing local BGG dictionary entries from cloud even without updatedAt', () => {
    const cloud = [{ id: '1', name: 'Cloud Only' }] as BggGame[];

    expect(mergeBggGames([], cloud)).toEqual(cloud);
  });

  it('merges template preferences by templateId and updatedAt', () => {
    const local: TemplatePreference[] = [
      { templateId: 'tpl-a', lastPlayerCount: 3, updatedAt: 300 },
      { templateId: 'tpl-b', lastPlayerCount: 2, updatedAt: 100 }
    ];
    const cloud: TemplatePreference[] = [
      { templateId: 'tpl-a', lastPlayerCount: 4, updatedAt: 200 },
      { templateId: 'tpl-b', lastPlayerCount: 5, updatedAt: 500 }
    ];

    expect(mergeTemplatePrefs(local, cloud)).toEqual([
      { templateId: 'tpl-a', lastPlayerCount: 3, updatedAt: 300 },
      { templateId: 'tpl-b', lastPlayerCount: 5, updatedAt: 500 }
    ]);
  });

  it('extracts only sessionContext weights from recommendation configs', () => {
    const configs: SystemWeightConfig[] = [
      { id: PLAYER_WEIGHTS_ID, weights: { game: 9, sessionContext: 1.2 }, updatedAt: 100 },
      { id: COUNT_WEIGHTS_ID, weights: { location: 8, sessionContext: 2.3 }, updatedAt: 100 },
      { id: LOCATION_WEIGHTS_ID, weights: { relatedPlayer: 7, sessionContext: 3.4 }, updatedAt: 100 }
    ];

    expect(extractSessionContextWeights(configs)).toEqual({
      player: 1.2,
      count: 2.3,
      location: 3.4
    });
  });

  it('keeps local sessionContext weights when present and falls back to cloud gaps', () => {
    expect(
      mergeSessionContextWeights(
        { player: 1.5, location: 2.5 },
        { player: 4.5, count: 3.5, location: 5 }
      )
    ).toEqual({ player: 1.5, count: 3.5, location: 2.5 });
  });

  it('builds patch updates only for valid sessionContext weight values', () => {
    expect(
      getSessionContextWeightUpdates({
        player: 1.1,
        count: undefined,
        location: Number.NaN
      })
    ).toEqual([{ id: PLAYER_WEIGHTS_ID, value: 1.1 }]);
  });
});

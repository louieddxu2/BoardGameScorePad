import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { inspectorTranslations } from '../../i18n/inspector';
import { DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS, DEFAULT_PLAYER_WEIGHTS } from './types';
import { COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID, PLAYER_WEIGHTS_ID, weightAdjustmentEngine } from './WeightAdjustmentEngine';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('lifecycle player recommendation weights', () => {
    it('uses shared 1.0 defaults and exposes Chinese and English labels', () => {
        expect(DEFAULT_PLAYER_WEIGHTS.gamePlayStage).toBe(1);
        expect(DEFAULT_PLAYER_WEIGHTS.gameRecency).toBe(1);
        expect(DEFAULT_COUNT_WEIGHTS.gamePlayStage).toBe(1);
        expect(DEFAULT_COUNT_WEIGHTS.gameRecency).toBe(1);
        expect(DEFAULT_LOCATION_WEIGHTS.gamePlayStage).toBe(1);
        expect(DEFAULT_LOCATION_WEIGHTS.gameRecency).toBe(1);
        expect(inspectorTranslations['zh-TW'].factor_gamePlayStage).toBe('遊玩階段');
        expect(inspectorTranslations['zh-TW'].factor_gameRecency).toBe('距上次遊玩');
        expect(inspectorTranslations.en.factor_gamePlayStage).toBe('Play Stage');
        expect(inspectorTranslations.en.factor_gameRecency).toBe('Game Recency');
        expect(inspectorTranslations['zh-TW'].tab_lifecycle).toBe('遊戲生命週期');
        expect(inspectorTranslations['zh-TW'].rel_game_play_stages).toBe('遊玩階段');
        expect(inspectorTranslations['zh-TW'].rel_game_recencies).toBe('距上次遊玩');
        expect(inspectorTranslations.en.tab_lifecycle).toBe('Game Lifecycle');
        expect(inspectorTranslations.en.rel_game_play_stages).toBe('Play Stages');
        expect(inspectorTranslations.en.rel_game_recencies).toBe('Game Recencies');
    });

    it('resets both lifecycle factors with the player model', async () => {
        vi.spyOn(db.weights, 'get').mockResolvedValue({
            id: PLAYER_WEIGHTS_ID,
            weights: { ...DEFAULT_PLAYER_WEIGHTS, gamePlayStage: 4, gameRecency: 4 },
            updatedAt: 1
        });
        const update = vi.spyOn(db.weights, 'update').mockResolvedValue(1);

        await weightAdjustmentEngine.resetWeightsExcept(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS, ['sessionContext']);

        expect(update).toHaveBeenCalledWith(PLAYER_WEIGHTS_ID, expect.objectContaining({
            'weights.gamePlayStage': 1,
            'weights.gameRecency': 1
        }));
    });

    it('resets both lifecycle factors with count and location models', async () => {
        vi.spyOn(db.weights, 'get')
            .mockResolvedValueOnce({
                id: COUNT_WEIGHTS_ID,
                weights: { ...DEFAULT_COUNT_WEIGHTS, gamePlayStage: 4, gameRecency: 4 },
                updatedAt: 1
            })
            .mockResolvedValueOnce({
                id: LOCATION_WEIGHTS_ID,
                weights: { ...DEFAULT_LOCATION_WEIGHTS, gamePlayStage: 4, gameRecency: 4 },
                updatedAt: 1
            });
        const update = vi.spyOn(db.weights, 'update').mockResolvedValue(1);

        await weightAdjustmentEngine.resetWeightsExcept(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS, ['sessionContext']);
        await weightAdjustmentEngine.resetWeightsExcept(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS, ['sessionContext']);

        for (const id of [COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID]) {
            expect(update).toHaveBeenCalledWith(id, expect.objectContaining({
                'weights.gamePlayStage': 1,
                'weights.gameRecency': 1
            }));
        }
    });
});

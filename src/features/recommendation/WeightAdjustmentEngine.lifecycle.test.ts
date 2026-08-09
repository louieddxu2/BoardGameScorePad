import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { inspectorTranslations } from '../../i18n/inspector';
import { DEFAULT_PLAYER_WEIGHTS } from './types';
import { PLAYER_WEIGHTS_ID, weightAdjustmentEngine } from './WeightAdjustmentEngine';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('lifecycle player recommendation weights', () => {
    it('uses shared 1.0 defaults and exposes Chinese and English labels', () => {
        expect(DEFAULT_PLAYER_WEIGHTS.gamePlayStage).toBe(1);
        expect(DEFAULT_PLAYER_WEIGHTS.gameRecency).toBe(1);
        expect(inspectorTranslations['zh-TW'].factor_gamePlayStage).toBe('遊玩階段');
        expect(inspectorTranslations['zh-TW'].factor_gameRecency).toBe('距上次遊玩');
        expect(inspectorTranslations.en.factor_gamePlayStage).toBe('Play Stage');
        expect(inspectorTranslations.en.factor_gameRecency).toBe('Game Recency');
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
});

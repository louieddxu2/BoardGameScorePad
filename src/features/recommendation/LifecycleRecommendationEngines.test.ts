import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { contextResolver, Voter } from './ContextResolver';
import { countRecommendationEngine } from './CountRecommendationEngine';
import { locationRecommendationEngine } from './LocationRecommendationEngine';
import { DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS } from './types';

function lifecycleVoter(id: string, relationKey: 'playerCounts' | 'locations', candidateId: string): Voter {
    const item: SavedListItem = {
        id,
        name: id,
        usageCount: 1,
        lastUsed: 1,
        meta: {
            relations: { [relationKey]: [{ id: candidateId, count: 1 }] },
            confidence: { [relationKey]: 1 }
        }
    };
    return {
        item,
        factor: id.startsWith('game_play_stage:') ? 'gamePlayStage' : 'gameRecency'
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('lifecycle count and location voting', () => {
    it('uses both lifecycle voters for player-count prediction', async () => {
        vi.spyOn(contextResolver, 'resolveCountContext').mockResolvedValue([
            lifecycleVoter('game_play_stage:second', 'playerCounts', 'count_4'),
            lifecycleVoter('game_recency:within_7_days', 'playerCounts', 'count_4')
        ]);

        await expect(countRecommendationEngine.generateSuggestions({}, DEFAULT_COUNT_WEIGHTS)).resolves.toEqual([4]);
    });

    it('uses both lifecycle voters for location prediction', async () => {
        vi.spyOn(contextResolver, 'resolveLocationContext').mockResolvedValue([
            lifecycleVoter('game_play_stage:second', 'locations', 'location-home'),
            lifecycleVoter('game_recency:within_7_days', 'locations', 'location-home')
        ]);
        vi.spyOn(db.savedLocations, 'where').mockReturnValue({
            anyOf: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([
                    { id: 'location-home', name: 'Home', usageCount: 1, lastUsed: 1 }
                ])
            })
        } as never);

        await expect(locationRecommendationEngine.generateSuggestions({}, DEFAULT_LOCATION_WEIGHTS)).resolves.toEqual(['Home']);
    });
});

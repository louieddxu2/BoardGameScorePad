
import { db } from '../../db';

export const PLAYER_WEIGHTS_ID = 'player_recommendation';
export const COUNT_WEIGHTS_ID = 'count_recommendation';
export const LOCATION_WEIGHTS_ID = 'location_recommendation';
export const COLOR_WEIGHTS_ID = 'color_recommendation';

export class WeightAdjustmentEngine {

    /**
     * Get weight configuration from the database.
     * Returns default weights merged with stored weights if found, otherwise returns defaults.
     * 
     * @param configId The unique ID for the weight configuration (e.g., 'player_recommendation')
     * @param defaultWeights The fallback weights object
     */
    public async getWeights<T>(configId: string, defaultWeights: T): Promise<T> {
        try {
            const config = await db.weights.get(configId);
            if (config && config.weights) {
                // Merge with defaults to ensure all keys exist
                return { ...defaultWeights, ...config.weights } as T;
            }
        } catch (e) {
            console.warn(`[WeightEngine] Failed to load weights for ${configId}`, e);
        }
        return { ...defaultWeights };
    }

    /**
     * Save the updated weight configuration to the database.
     * 
     * @param configId The unique ID for the weight configuration
     * @param weights The weights object to save
     */
    public async saveWeights<T>(configId: string, weights: T): Promise<void> {
        try {
            await db.weights.put({
                id: configId,
                weights: weights as unknown as Record<string, number>,
                updatedAt: Date.now()
            });
        } catch (e) {
            console.warn(`[WeightEngine] Failed to save weights for ${configId}`, e);
        }
    }

    /**
     * Calculate the new weight based on whether the factor predicted correctly.
     * 
     * Logic:
     * - Bounds: 0.2 to 5.0
     * - Hit: +0.1 (damped if >= 3.0)
     * - Miss: -0.2 (scaled by penaltyFactor)
     * 
     * @param currentWeight Current weight value
     * @param isHit Whether the prediction was correct
     * @param penaltyFactor (0.0 to 1.0) Reduces penalty for low-sample scenarios. Default 1.0.
     */
    public calculateNewWeight(currentWeight: number, isHit: boolean, penaltyFactor: number = 1.0): number {
        const MIN = 0.2;
        const MAX = 5.0;
        const PENALTY = 0.2;
        const REWARD = 0.1;
        
        let newWeight = currentWeight;

        if (isHit) {
            let delta = REWARD;
            // Damping logic: Slow down growth after 3.0
            if (currentWeight >= 3.0) {
                delta = REWARD * (1 - (currentWeight / MAX));
            }
            newWeight += delta;
        } else {
            // Apply Penalty Damping: If we don't have enough data to predict, don't punish full amount.
            newWeight -= (PENALTY * penaltyFactor);
        }

        return Math.max(this.MIN_CONFIDENCE || MIN, Math.min(this.MAX_CONFIDENCE || MAX, Math.round(newWeight * 100) / 100));
    }
    
    // Bounds helpers (for flexibility if needed later)
    private readonly MIN_CONFIDENCE = 0.2;
    private readonly MAX_CONFIDENCE = 5.0;
}

export const weightAdjustmentEngine = new WeightAdjustmentEngine();

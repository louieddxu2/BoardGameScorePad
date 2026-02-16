
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { RecommendationContext, PlayerRecommendationFactor } from './types';

export interface Voter {
    item: SavedListItem;
    factor: PlayerRecommendationFactor;
}

export class ContextResolver {

    /**
     * 根據傳入的推薦情境 (Game, Location, Time...)，從資料庫撈取對應的實體。
     * 這些實體將作為「投票者 (Voters)」。
     */
    public async resolveBaseContext(context: RecommendationContext): Promise<Voter[]> {
        const promises: Promise<Voter | null>[] = [];

        // Helper to wrap DB call with Factor tag
        const fetch = (promise: Promise<SavedListItem | undefined>, factor: PlayerRecommendationFactor): Promise<Voter | null> => {
            return promise.then(item => item ? { item, factor } : null);
        };

        // A. Game (Try BGG ID first, then Name)
        if (context.bggId) {
            promises.push(fetch(db.savedGames.where('bggId').equals(context.bggId).first(), 'game'));
        }
        if (context.gameName) {
            promises.push(fetch(db.savedGames.where('name').equals(context.gameName).first(), 'game'));
        }

        // B. Location
        if (context.locationName) {
            promises.push(fetch(db.savedLocations.where('name').equals(context.locationName).first(), 'location'));
        }

        // C. Time Dimensions
        const ts = context.timestamp || Date.now();
        const date = new Date(ts);
        const dayIndex = date.getDay();
        const slotIndex = Math.floor(date.getHours() / 3);
        
        promises.push(fetch(db.savedWeekdays.get(`weekday_${dayIndex}`), 'weekday'));
        promises.push(fetch(db.savedTimeSlots.get(`timeslot_${slotIndex}`), 'timeSlot'));

        // D. Player Count
        if (context.playerCount) {
            promises.push(fetch(db.savedPlayerCounts.get(`count_${context.playerCount}`), 'playerCount'));
        }

        // E. Game Mode
        if (context.scoringRule) {
            promises.push(fetch(db.savedGameModes.get(context.scoringRule), 'gameMode'));
        }

        // F. Session Context (Short-Term Memory)
        promises.push(fetch(db.savedCurrentSession.get('current_session'), 'sessionContext'));

        const results = await Promise.all(promises);
        
        // Deduplicate voters (Remove nulls and duplicates by ID)
        const uniqueVoters = new Map<string, Voter>();
        results.forEach((voter) => {
            if (voter && !uniqueVoters.has(voter.item.id)) {
                uniqueVoters.set(voter.item.id, voter);
            }
        });

        return Array.from(uniqueVoters.values());
    }

    /**
     * 根據一組 Player ID，撈取對應的 Player 實體作為投票者。
     * 用於「玩家推薦玩家」的連鎖預測。
     */
    public async resolvePlayerVoters(playerIds: string[]): Promise<Voter[]> {
        if (playerIds.length === 0) return [];
        const players = await db.savedPlayers.where('id').anyOf(playerIds).toArray();
        return players.map(p => ({ item: p, factor: 'relatedPlayer' }));
    }
}

export const contextResolver = new ContextResolver();

import { COLORS } from '../../colors';
import { votingEngine, Voter } from '../../features/recommendation/VotingEngine';
import {
    ColorRecommendationWeights,
    CountRecommendationWeights,
    LocationRecommendationWeights,
    PlayerRecommendationWeights
} from '../../features/recommendation/types';
import { AnalyticsLog, HistoryRecord, PredictionModelOutcome, PredictionModelKey, SavedListItem } from '../../types';
import { RelationMapper } from './RelationMapper';
import { ResolvedEntity } from './types';

export interface PredictionStrengthWeights {
    player: PlayerRecommendationWeights;
    count: CountRecommendationWeights;
    location: LocationRecommendationWeights;
    color: ColorRecommendationWeights;
}

export type PredictionStrengthResult = Partial<Record<PredictionModelKey, PredictionModelOutcome>>;

export interface PredictionStrengthSummary extends PredictionModelOutcome {
    rate: number;
    games: number;
}

export function summarizeRecentPredictionStrength(
    logs: AnalyticsLog[],
    model: PredictionModelKey,
    limit = 10
): PredictionStrengthSummary | undefined {
    const recent = logs
        .filter(log => (log.predictionStrength?.[model]?.total || 0) > 0)
        .sort((a, b) => (b.referenceStartTime ?? b.lastProcessedAt) - (a.referenceStartTime ?? a.lastProcessedAt))
        .slice(0, limit)
        .map(log => log.predictionStrength![model]!);
    if (recent.length === 0) return undefined;
    const hits = recent.reduce((sum, outcome) => sum + outcome.hits, 0);
    const total = recent.reduce((sum, outcome) => sum + outcome.total, 0);
    return { hits, total, games: recent.length, rate: total > 0 ? hits / total : 0 };
}

const sortScoreIds = (scores: Map<string, number>): string[] => Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);

const uniqueItems = (items: SavedListItem[]): SavedListItem[] =>
    Array.from(new Map(items.map(item => [item.id, item])).values());

export class PredictionStrengthEvaluator {
    public evaluate(
        record: HistoryRecord,
        entities: ResolvedEntity[],
        savedPlayers: SavedListItem[],
        savedLocations: SavedListItem[],
        weights: PredictionStrengthWeights
    ): PredictionStrengthResult {
        const result: PredictionStrengthResult = {};
        const actualPlayers = uniqueItems(entities.filter(entity => entity.type === 'player').map(entity => entity.item));
        const priorPlayers = uniqueItems(savedPlayers).filter(player => (player.usageCount || 0) > 0);
        const priorLocations = uniqueItems(savedLocations).filter(location => (location.usageCount || 0) > 0);

        if (actualPlayers.length > 0 && priorPlayers.length > 0) {
            const voters = this.getVoters(entities, 'player');
            const predictedIds = this.predictPlayers(priorPlayers, voters, actualPlayers.length, weights.player);
            if (predictedIds.length > 0) {
                const actualIds = new Set(actualPlayers.map(player => player.id));
                result.player = {
                    hits: predictedIds.filter(id => actualIds.has(id)).length,
                    total: actualPlayers.length
                };
            }
        }

        const actualCountId = entities.find(entity => entity.type === 'playerCount')?.item.id;
        if (actualCountId) {
            const limit = RelationMapper.getVotingLimit('playerCounts');
            const ids = this.predictIds(this.getVoters(entities, 'count'), weights.count, 'playerCounts', limit);
            if (ids.length > 0) result.count = { hits: ids.slice(0, limit).includes(actualCountId) ? 1 : 0, total: 1 };
        }

        const actualLocationId = entities.find(entity => entity.type === 'location')?.item.id;
        if (actualLocationId && priorLocations.length > 0) {
            const limit = RelationMapper.getVotingLimit('locations', priorLocations.length);
            const ids = this.predictIds(this.getVoters(entities, 'location'), weights.location, 'locations', limit);
            if (ids.length > 0) result.location = { hits: ids.slice(0, limit).includes(actualLocationId) ? 1 : 0, total: 1 };
        }

        const colorOutcome = this.evaluateColors(record, entities, actualPlayers, weights.color);
        if (colorOutcome) result.color = colorOutcome;

        return result;
    }

    private getVoters(entities: ResolvedEntity[], model: 'player' | 'count' | 'location'): Voter[] {
        return entities.flatMap(entity => {
            const factor = model === 'player'
                ? RelationMapper.getRecommendationFactor(entity.type)
                : model === 'count'
                    ? RelationMapper.getCountRecommendationFactor(entity.type)
                    : RelationMapper.getLocationRecommendationFactor(entity.type);
            if (!factor) return [];
            // Actual players are answers for player prediction, not context known in advance.
            if (model === 'player' && entity.type === 'player') return [];
            return [{ item: entity.item, factor } as Voter];
        });
    }

    private predictPlayers(
        players: SavedListItem[],
        baseVoters: Voter[],
        count: number,
        weights: PlayerRecommendationWeights
    ): string[] {
        const selected: string[] = [];
        const byId = new Map(players.map(player => [player.id, player]));
        const voteLimit = RelationMapper.getVotingLimit('players', players.length);
        for (let index = 0; index < count; index++) {
            const relatedVoters: Voter[] = selected.flatMap(id => {
                const player = byId.get(id);
                return player ? [{ item: player, factor: 'relatedPlayer' as const }] : [];
            });
            const ids = this.predictIds([...baseVoters, ...relatedVoters], weights, 'players', voteLimit, selected);
            const next = ids.find(id => byId.has(id));
            if (!next) break;
            selected.push(next);
        }
        return selected;
    }

    private predictIds(
        voters: Voter[],
        weights: object,
        relationKey: string,
        limit: number,
        ignored: string[] = []
    ): string[] {
        return sortScoreIds(votingEngine.calculateScores(voters, weights as Record<string, number>, relationKey, ignored, limit));
    }

    private evaluateColors(
        record: HistoryRecord,
        entities: ResolvedEntity[],
        actualPlayers: SavedListItem[],
        weights: ColorRecommendationWeights
    ): PredictionModelOutcome | undefined {
        const recordPlayersBySavedId = new Map<string, string>();
        for (const player of record.players) {
            const saved = actualPlayers.find(item => item.id === player.linkedPlayerId || item.id === player.id || item.name === player.name);
            if (saved && player.color && player.color !== 'transparent') recordPlayersBySavedId.set(saved.id, player.color);
        }
        if (recordPlayersBySavedId.size === 0) return undefined;

        const game = entities.find(entity => entity.type === 'game')?.item;
        const templateColors = record.snapshotTemplate?.supportedColors || [];
        const templateVoter: Voter | undefined = templateColors.length > 0 ? {
            item: {
                id: 'template_settings_virtual', name: 'Template Settings', lastUsed: 0, usageCount: 0,
                meta: { relations: { colors: templateColors.map(id => ({ id, count: 0 })) }, confidence: { colors: 5 } }
            },
            factor: 'templateSetting'
        } : undefined;
        const usedColors: string[] = [];
        let hits = 0;
        let total = 0;
        for (const player of actualPlayers) {
            const actualColor = recordPlayersBySavedId.get(player.id);
            if (!actualColor || (player.usageCount || 0) === 0) continue;
            const voters: Voter[] = [
                ...(templateVoter ? [templateVoter] : []),
                ...(game ? [{ item: game, factor: 'game' as const }] : []),
                { item: player, factor: 'player' }
            ];
            const predicted = this.predictIds(voters, weights, 'colors', RelationMapper.getVotingLimit('colors'), usedColors)
                .filter(color => color !== 'transparent');
            if (predicted.length === 0) continue;
            const chosen = predicted[0] || [...templateColors, ...COLORS].find(color => !usedColors.includes(color));
            if (chosen) usedColors.push(chosen);
            hits += chosen === actualColor ? 1 : 0;
            total++;
        }
        return total > 0 ? { hits, total } : undefined;
    }
}

export const predictionStrengthEvaluator = new PredictionStrengthEvaluator();

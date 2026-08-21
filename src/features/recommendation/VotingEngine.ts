import { SavedListItem } from '../../types';
import { RankVotingPolicy } from '../../services/relationship/RankVotingPolicy';
import { RecommendationFactor } from './types';

export interface Voter {
    item: SavedListItem;
    factor: RecommendationFactor;
}

export class VotingEngine {
    public calculateScores(
        voters: Voter[],
        weights: Record<string, number>,
        relationKey: string,
        ignoreIds: string[] = [],
        candidateLimit: number = 5
    ): Map<string, number> {
        const scores = new Map<string, number>();
        const ignoreSet = new Set(ignoreIds);
        const rankWindow = RankVotingPolicy.getRankWindow(candidateLimit);

        for (const { item: voter, factor } of voters) {
            const rawCandidates = voter?.meta?.relations?.[relationKey];
            if (!Array.isArray(rawCandidates)) continue;

            const candidates = rawCandidates
                .map((candidate: unknown) => {
                    if (typeof candidate === 'string') return candidate;
                    if (typeof candidate === 'object' && candidate !== null && 'id' in candidate) {
                        const id = (candidate as { id?: unknown }).id;
                        return typeof id === 'string' ? id : null;
                    }
                    return null;
                })
                .filter((id): id is string => id !== null);

            const confidence = voter.meta?.confidence?.[relationKey] ?? 1;
            const factorWeight = weights[factor] ?? 1;
            const rankWeights = RankVotingPolicy.getWeights(voter.meta?.rankWeights?.[relationKey], candidateLimit);

            for (let rank = 0; rank < Math.min(candidates.length, rankWindow); rank++) {
                const candidateId = candidates[rank];
                if (ignoreSet.has(candidateId)) continue;

                const baseScore = rankWeights[rank];
                if (baseScore <= 0) continue;

                const finalScore = baseScore * confidence * factorWeight;
                scores.set(candidateId, (scores.get(candidateId) || 0) + finalScore);
            }
        }

        return scores;
    }
}

export const votingEngine = new VotingEngine();

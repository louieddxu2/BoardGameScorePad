import { RelationItem } from './types';

export class RankVotingPolicy {
    public static readonly MAX_WEIGHT = 5;
    public static readonly TRANSFER_PER_RECORD = 0.5;

    public static getRankWindow(votingLimit: number): number {
        return Math.max(1, votingLimit) * 2;
    }

    public static getDefaultWeights(votingLimit: number): number[] {
        const limit = Math.max(1, votingLimit);
        return Array.from({ length: this.getRankWindow(limit) }, (_, rank) =>
            rank < limit ? Math.max(1, this.MAX_WEIGHT - rank) : 0
        );
    }

    public static getWeights(weights: number[] | undefined, votingLimit: number): number[] {
        const defaults = this.getDefaultWeights(votingLimit);
        if (!Array.isArray(weights) || weights.length !== defaults.length || weights.some(value => !Number.isFinite(value))) {
            return defaults;
        }

        const minimums = defaults.map((_, rank) => rank < votingLimit ? 1 : 0);
        const cents = weights.map((value, rank) =>
            Math.max(minimums[rank], Math.min(500, Math.round(value * 100)))
        );
        this.normalizeCents(cents, defaults.reduce((sum, value) => sum + value, 0) * 100, minimums);
        return cents.map(value => value / 100);
    }

    public static rankCandidates(
        currentList: RelationItem[] | undefined,
        weights: number[] | undefined,
        votingLimit: number
    ): RelationItem[] {
        const normalized = this.getWeights(weights, votingLimit);
        const list = currentList || [];
        const window = list.slice(0, this.getRankWindow(votingLimit))
            .map((item, rank) => ({ item, rank, weight: normalized[rank] }));
        const positive = window
            .filter(candidate => candidate.weight > 0)
            .sort((a, b) => b.weight - a.weight || a.rank - b.rank);
        const zero = window.filter(candidate => candidate.weight <= 0);
        return [
            ...positive.map(candidate => candidate.item),
            ...zero.map(candidate => candidate.item),
            ...list.slice(this.getRankWindow(votingLimit))
        ];
    }

    public static adjustWeights(
        currentList: RelationItem[] | undefined,
        activeIds: string[],
        weights: number[] | undefined,
        votingLimit: number
    ): number[] {
        const normalized = this.getWeights(weights, votingLimit);
        if (!currentList || currentList.length === 0) return normalized;

        const rankWindow = this.getRankWindow(votingLimit);
        const candidates = currentList.slice(0, rankWindow);
        const activeSet = new Set(activeIds);
        const seenIds = new Set<string>();
        const hitRanks: number[] = [];

        candidates.forEach((item, rank) => {
            if (seenIds.has(item.id)) return;
            seenIds.add(item.id);
            if (activeSet.has(item.id)) hitRanks.push(rank);
        });
        if (hitRanks.length === 0) return normalized;

        const minimums = normalized.map((_, rank) => rank < votingLimit ? 1 : 0);
        const cents = normalized.map(value => Math.round(value * 100));
        const recipients = hitRanks.filter(rank => cents[rank] < 500);
        const donors = candidates
            .map((_, rank) => rank)
            .filter(rank => !hitRanks.includes(rank) && cents[rank] > minimums[rank]);
        const recipientCapacity = recipients.reduce((sum, rank) => sum + 500 - cents[rank], 0);
        const donorCapacity = donors.reduce((sum, rank) => sum + cents[rank] - minimums[rank], 0);
        const transfer = Math.min(50, recipientCapacity, donorCapacity);
        if (transfer <= 0) return normalized;

        for (let cent = 0; cent < transfer; cent++) {
            cents[recipients[cent % recipients.length]]++;
        }

        const totalDonorCapacity = donors.reduce((sum, rank) => sum + cents[rank] - minimums[rank], 0);
        const deductions = donors.map(rank => {
            const capacity = cents[rank] - minimums[rank];
            const exact = transfer * capacity / totalDonorCapacity;
            return { rank, capacity, amount: Math.floor(exact), fraction: exact - Math.floor(exact) };
        });
        let deducted = deductions.reduce((sum, entry) => sum + entry.amount, 0);
        deductions.sort((a, b) => b.fraction - a.fraction || a.rank - b.rank);
        for (let index = 0; deducted < transfer; index = (index + 1) % deductions.length) {
            const deduction = deductions[index];
            if (deduction.amount < deduction.capacity) {
                deduction.amount++;
                deducted++;
            }
        }
        deductions.forEach(({ rank, amount }) => { cents[rank] -= amount; });

        const totalCents = this.getDefaultWeights(votingLimit).reduce((sum, value) => sum + value, 0) * 100;
        this.normalizeCents(cents, totalCents, minimums);
        return cents.map(value => value / 100);
    }

    private static normalizeCents(cents: number[], target: number, minimums: number[]): void {
        let difference = target - cents.reduce((sum, value) => sum + value, 0);
        while (difference !== 0) {
            const candidates = cents
                .map((value, rank) => ({ value, rank }))
                .filter(({ value, rank }) => difference > 0 ? value < 500 : value > minimums[rank])
                .sort((a, b) => difference > 0 ? a.rank - b.rank : b.value - a.value || a.rank - b.rank);
            if (candidates.length === 0) break;
            for (const { rank } of candidates) {
                if (difference === 0) break;
                cents[rank] += difference > 0 ? 1 : -1;
                difference += difference > 0 ? -1 : 1;
            }
        }
    }
}

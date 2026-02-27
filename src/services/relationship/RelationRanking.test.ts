import { describe, it, expect } from 'vitest';
import { RelationRanking } from './RelationRanking';
import { RelationItem } from './types';

describe('RelationRanking (Halving & Count-Bounded Hybrid)', () => {

    it('Case A: High-frequency returning user (count high) jumps to the front', () => {
        const currentList: RelationItem[] = [
            { id: 'A', count: 100 },
            { id: 'B', count: 80 },
            { id: 'C', count: 50 },
            { id: 'D', count: 30 },
            { id: 'E', count: 20 },
            { id: 'OldKing', count: 85 }, // pos 5
        ];

        // OldKing gets played. Count becomes 86.
        // Halved pos: Math.floor(5 / 2) = 2.
        // Count pos: First <= 86 is B(80) at index 1.
        // Target: min(2, 1) = 1.
        const result = RelationRanking.update(currentList, ['OldKing'], 10);

        expect(result.map(r => r.id)).toEqual(['A', 'OldKing', 'B', 'C', 'D', 'E']);
        expect(result.find(r => r.id === 'OldKing')?.count).toBe(86);
    });

    it('Case B: New items often insert at 50% due to halving dominance', () => {
        const currentList: RelationItem[] = [
            { id: 'A', count: 10 },
            { id: 'B', count: 8 },
            { id: 'C', count: 6 },
            { id: 'D', count: 4 },
            { id: 'E', count: 1 },
            { id: 'F', count: 1 },
        ]; // Length 6

        // NewUser gets played. Count becomes 1.
        // Original pos: 6. Halved pos: Math.floor(6 / 2) = 3.
        // Count pos: First <= 1 is E(1) at index 4.
        // Target: min(3, 4) = 3.
        const result = RelationRanking.update(currentList, ['NewUser'], 10);

        // Expect NewUser to be inserted at index 3 (before D).
        expect(result.map(r => r.id)).toEqual(['A', 'B', 'C', 'NewUser', 'D', 'E', 'F']);
        expect(result.find(r => r.id === 'NewUser')?.count).toBe(1);
    });

    it('Case C: Low-frequency active user benefits from halving, bypassing higher counts', () => {
        const currentList: RelationItem[] = [
            { id: 'A', count: 100 },
            { id: 'B', count: 50 },
            { id: 'C', count: 30 },
            { id: 'LowFreq', count: 5 }, // pos 3
            { id: 'D', count: 4 },
            { id: 'E', count: 2 },
        ];

        // LowFreq gets played. Count becomes 6.
        // Halved pos: Math.floor(3 / 2) = 1.
        // Count pos: First <= 6 is D(4) at index 3 (excluding itself).
        // Target: min(1, 3) = 1.
        const result = RelationRanking.update(currentList, ['LowFreq'], 10);

        // Expect LowFreq to jump to index 1, temporarily bypassing B(50).
        expect(result.map(r => r.id)).toEqual(['A', 'LowFreq', 'B', 'C', 'D', 'E']);
    });

    it('Case D: Stable relative order for multiple active items', () => {
        const currentList: RelationItem[] = [
            { id: 'A', count: 15 },
            { id: 'B', count: 10 }, // pos 1
            { id: 'C', count: 5 },
            { id: 'D', count: 12 }, // pos 3
            { id: 'E', count: 2 },
        ];

        const result = RelationRanking.update(currentList, ['B', 'D'], 10);

        // B (count 11): Org 1. Halved 0. Count pos 1. Target: min(0,1) = 0.
        // D (count 13): Org 3. Halved 1. Count pos 2. Target: max(insertTargetIndex=1, min(1,2)) = 1.
        // Expected order: B, D, A, C, E.
        expect(result.map(r => r.id)).toEqual(['B', 'D', 'A', 'C', 'E']);
    });

    it('Case E: Multiple new items maintain their input order at the tail', () => {
        const currentList: RelationItem[] = [
            { id: 'A', count: 2 },
            { id: 'B', count: 1 },
        ];

        // New items N1, N2.
        // N1 (pos 2): halved 1. Count pos 1. Target: min(1,1)=1. (A, N1, B)
        // N2 (pos 3): halved 1. Count pos 2. Target: max(2, min(1,2)) = 2. (A, N1, N2, B)
        const result = RelationRanking.update(currentList, ['N1', 'N2'], 10);

        expect(result.map(r => r.id)).toEqual(['A', 'N1', 'N2', 'B']);
    });
});

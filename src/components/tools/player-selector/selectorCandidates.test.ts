import { describe, expect, it } from 'vitest';
import { getFourCandidatesForTouch, getManualSessionPlayerCandidates, getPlayerCandidateLocks, prioritizePlayerCandidates } from './selectorCandidates';
import { Candidate, SelectorPlayer } from './types';
import { OptionState } from './selectorEngineTypes';
import { Player } from '../../../types';

const makePlayer = (name: string): SelectorPlayer => ({
    id: `player-${name}`,
    text: name,
    x: 0,
    y: 0,
    textRotationDeg: 0,
    color: '#ef4444',
    state: 'READY'
});

describe('selectorCandidates', () => {
    it('prioritizes only manually set session players and removes identity duplicates', () => {
        const sessionPlayers: Player[] = [
            { id: 'slot-1', name: 'Alice edited', linkedPlayerId: 'saved-a', color: '#fff', scores: {}, totalScore: 0, isIdentityManuallySet: true },
            { id: 'slot-2', name: 'Wrong prediction', linkedPlayerId: 'saved-b', color: '#000', scores: {}, totalScore: 0, isIdentityManuallySet: false },
            { id: 'slot-3', name: 'Manual Guest', color: '#333', scores: {}, totalScore: 0, isIdentityManuallySet: true }
        ];

        const manualCandidates = getManualSessionPlayerCandidates(sessionPlayers);
        const result = prioritizePlayerCandidates(manualCandidates, [
            { id: 'saved-a', linkedPlayerId: 'saved-a', name: 'Alice old' },
            { id: 'saved-b', linkedPlayerId: 'saved-b', name: 'Wrong prediction' },
            { id: 'saved-c', linkedPlayerId: 'saved-c', name: 'Carol' },
            { id: 'same-name-guest', name: 'Manual Guest' }
        ]);

        expect(result).toEqual([
            { id: 'saved-a', linkedPlayerId: 'saved-a', name: 'Alice edited' },
            { id: 'session-player:slot-3', linkedPlayerId: undefined, name: 'Manual Guest' },
            { id: 'saved-b', linkedPlayerId: 'saved-b', name: 'Wrong prediction' },
            { id: 'saved-c', linkedPlayerId: 'saved-c', name: 'Carol' },
            { id: 'same-name-guest', name: 'Manual Guest' }
        ]);

        expect(getPlayerCandidateLocks(manualCandidates, [
            { ...makePlayer('Selected'), linkedPlayerId: 'saved-selected' }
        ])).toEqual({
            lockedPlayerIds: ['saved-a', 'saved-selected'],
            lockedNames: ['Alice edited', 'Manual Guest', 'Selected']
        });
    });

    it('keeps distinct same-name identities and excludes only the selected candidate', () => {
        const candidates: Candidate[] = [
            { id: 'saved-a', linkedPlayerId: 'saved-a', name: 'Alex' },
            { id: 'saved-b', linkedPlayerId: 'saved-b', name: 'Alex' },
            { id: 'saved-c', linkedPlayerId: 'saved-c', name: 'Carol' },
            { id: 'saved-d', linkedPlayerId: 'saved-d', name: 'Dan' }
        ];

        expect(prioritizePlayerCandidates(candidates.slice(0, 2), candidates.slice(2)))
            .toHaveLength(4);

        const result = getFourCandidatesForTouch(
            candidates,
            [],
            [{ ...makePlayer('Alex'), candidateId: 'saved-a', linkedPlayerId: 'saved-a' }],
            ['Eve'],
            name => `fallback-${name}`,
            index => `temp-${index}`
        );

        expect(result.map(candidate => candidate.id)).toEqual(['saved-b', 'saved-c', 'saved-d', 'fallback-Eve']);
    });

    it('skips selected player names and backfills from recommendations before random names', () => {
        const candidates: Candidate[] = [
            { id: 'a', name: 'Alice' },
            { id: 'b', name: 'Bob' },
            { id: 'c', name: 'Carol' },
            { id: 'd', name: 'Dan' }
        ];
        const options: OptionState[] = [{
            id: 1,
            touchId: 'touch',
            idx: 0,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            frozenX: null,
            frozenY: null,
            text: 'Alice',
            color: '#ef4444',
            candidate: candidates[0]
        }];

        const result = getFourCandidatesForTouch(
            candidates,
            options,
            [makePlayer('Bob')],
            ['Eve', 'Frank'],
            name => `fallback-${name}`,
            index => `temp-${index}`
        );

        expect(result.map(candidate => candidate.name)).toEqual(['Alice', 'Carol', 'Dan', 'Eve']);
    });

    it('creates temporary candidates when recommendations and fallback names are exhausted', () => {
        const result = getFourCandidatesForTouch(
            [],
            [],
            [],
            [],
            name => `fallback-${name}`,
            index => `temp-${index}`
        );

        expect(result).toEqual([
            { id: 'temp-1', name: 'Player 2' },
            { id: 'temp-2', name: 'Player 3' },
            { id: 'temp-3', name: 'Player 4' },
            { id: 'temp-4', name: 'Player 5' }
        ]);
    });

    it('excludes skippedIds from candidates even if they are in candidates list', () => {
        const candidates: Candidate[] = [
            { id: 'a', name: 'Alice' },
            { id: 'b', name: 'Bob' },
            { id: 'c', name: 'Carol' },
            { id: 'd', name: 'Dan' },
            { id: 'e', name: 'Eve' }
        ];

        const result = getFourCandidatesForTouch(
            candidates,
            [],
            [],
            ['Frank', 'Grace'],
            name => `fallback-${name}`,
            index => `temp-${index}`,
            ['a', 'c']
        );

        expect(result.map(c => c.name)).toEqual(['Bob', 'Dan', 'Eve', 'Frank']);
    });
});

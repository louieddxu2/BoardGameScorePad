import { describe, expect, it } from 'vitest';
import { getFourCandidatesForTouch } from './selectorCandidates';
import { Candidate, SelectorPlayer } from './types';
import { OptionState } from './selectorEngineTypes';

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

        expect(result.map(candidate => candidate.name)).toEqual(['Carol', 'Dan', 'Alice', 'Eve']);
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
});

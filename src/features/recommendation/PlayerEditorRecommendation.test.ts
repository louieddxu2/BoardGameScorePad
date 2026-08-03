import { describe, expect, it } from 'vitest';
import { GameSession, Player, SavedListItem } from '../../types';
import { getPlayerEditorRecommendations, searchPlayerEditorCandidates } from './PlayerEditorRecommendation';

const makeSavedPlayer = (
    id: string,
    name: string,
    usageCount = 1,
    relations?: Record<string, unknown[]>
): SavedListItem => ({
    id,
    name,
    usageCount,
    lastUsed: usageCount,
    meta: relations ? { relations } : undefined
});

const makeSession = (players: Player[]): GameSession => ({
    id: 'session-1',
    templateId: 'template-1',
    name: 'Test Game',
    startTime: 1,
    status: 'active',
    players
});

const makePlayer = (id: string, name: string, linkedPlayerId?: string): Player => ({
    id,
    name,
    color: '#000000',
    scores: {},
    totalScore: 0,
    linkedPlayerId
});

describe('PlayerEditorRecommendation', () => {
    it('uses only players to the left as voters while retaining later names', () => {
        const savedPlayers = [
            makeSavedPlayer('alice', 'Alice', 1, { players: [{ id: 'bob', count: 5 }] }),
            makeSavedPlayer('current', 'Current', 1, { players: [{ id: 'charlie', count: 5 }] }),
            makeSavedPlayer('bob', 'Bob', 1),
            makeSavedPlayer('charlie', 'Charlie', 99)
        ];
        const session = makeSession([
            makePlayer('seat-left', 'Alice', 'alice'),
            makePlayer('seat-current', 'Current', 'current'),
            makePlayer('seat-right', 'Bob', 'bob')
        ]);

        const result = getPlayerEditorRecommendations({
            session,
            playerId: 'seat-current',
            allSavedPlayers: savedPlayers,
            contextVoters: []
        });

        expect(result[0]).toMatchObject({ name: 'Bob', linkedPlayerId: 'bob' });
        expect(result.some(candidate => candidate.name === 'Bob')).toBe(true);
        expect(result.some(candidate => candidate.name === 'Alice')).toBe(false);
    });

    it('keeps the seat id stable when a later player identity is selected', () => {
        const session = makeSession([
            makePlayer('seat-current', 'Current'),
            makePlayer('seat-right', 'Bob', 'bob')
        ]);
        const candidate = getPlayerEditorRecommendations({
            session,
            playerId: 'seat-current',
            allSavedPlayers: [makeSavedPlayer('bob', 'Bob')],
            contextVoters: []
        }).find(item => item.name === 'Bob');

        expect(candidate).toMatchObject({ id: 'bob', linkedPlayerId: 'bob' });
        const updatedCurrent = {
            ...session.players[0],
            name: candidate!.name,
            linkedPlayerId: candidate!.linkedPlayerId
        };
        expect(updatedCurrent.id).toBe('seat-current');
        expect(session.players[1].id).toBe('seat-right');
        expect(updatedCurrent.linkedPlayerId).toBe(session.players[1].linkedPlayerId);
    });

    it('preserves a later name even when it shares a linked identity with a prior seat', () => {
        const session = makeSession([
            makePlayer('seat-left', 'Alice', 'shared-id'),
            makePlayer('seat-current', 'Current'),
            makePlayer('seat-right', 'Alice Alias', 'shared-id')
        ]);

        const result = getPlayerEditorRecommendations({
            session,
            playerId: 'seat-current',
            allSavedPlayers: [makeSavedPlayer('shared-id', 'Alice')],
            contextVoters: []
        });

        expect(result).toContainEqual({
            id: 'seat-right',
            name: 'Alice Alias',
            linkedPlayerId: 'shared-id'
        });
    });

    it('searches the complete saved-player list for non-empty input', () => {
        const savedPlayers = Array.from({ length: 51 }, (_, index) => (
            makeSavedPlayer(`saved-${index + 1}`, `Player ${index + 1}`)
        ));

        expect(searchPlayerEditorCandidates(savedPlayers, 'Player 51')).toEqual([
            { id: 'saved-51', name: 'Player 51', linkedPlayerId: 'saved-51' }
        ]);
    });
});

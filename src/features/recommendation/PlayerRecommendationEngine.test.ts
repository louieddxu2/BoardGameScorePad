import { describe, it, expect } from 'vitest';
import { getRecommendedCandidatesPure } from './PlayerRecommendationEngine';
import { SavedListItem } from '../../types';
import { Voter } from './ContextResolver';

describe('getRecommendedCandidatesPure', () => {
    const mockSavedPlayers: SavedListItem[] = [
        {
            id: 'player_1',
            name: 'Alice',
            usageCount: 10,
            lastUsed: 1000,
            meta: {
                relations: {
                    players: [
                        { id: 'player_2', count: 5 },
                        { id: 'player_3', count: 3 }
                    ]
                }
            }
        },
        {
            id: 'player_2',
            name: 'Bob',
            usageCount: 5,
            lastUsed: 500,
            meta: {
                relations: {
                    players: [
                        { id: 'player_1', count: 5 }
                    ]
                }
            }
        },
        {
            id: 'player_3',
            name: 'Charlie',
            usageCount: 8,
            lastUsed: 800,
            meta: {
                relations: {}
            }
        },
        {
            id: 'player_4',
            name: 'David',
            usageCount: 1,
            lastUsed: 100,
            meta: {
                relations: {}
            }
        }
    ];

    it('should sort by usageCount and lastUsed when no players are locked and no votes', () => {
        const result = getRecommendedCandidatesPure({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: [],
            lockedNames: [],
            sessionPlayers: []
        });

        // 預期順序：Alice (10) -> Charlie (8) -> Bob (5) -> David (1)
        expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie', 'Bob', 'David']);
    });

    it('should calculate relation scores and recommend related players first', () => {
        // 鎖定 Alice
        const result = getRecommendedCandidatesPure({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1'],
            lockedNames: ['Alice'],
            sessionPlayers: []
        });

        // Alice 關係人：Bob (count 5) 與 Charlie (count 3)
        // 排除 Alice 後，Bob 分數最高排首位，Charlie 居次，其餘排後面
        expect(result.map(r => r.name)).toEqual(['Bob', 'Charlie', 'David']);
    });

    it('should exclude locked player IDs from recommendation list', () => {
        // 鎖定 Alice 與 Bob
        const result = getRecommendedCandidatesPure({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1', 'player_2'],
            lockedNames: ['Alice', 'Bob'],
            sessionPlayers: []
        });

        // 驗證 Alice 與 Bob 已被排除
        expect(result.find(r => r.id === 'player_1')).toBeUndefined();
        expect(result.find(r => r.id === 'player_2')).toBeUndefined();
        expect(result.map(r => r.name)).toEqual(['Charlie', 'David']);
    });

    it('should fill with session players when recommended count is less than 4', () => {
        // 鎖定 Alice 與 Bob，剩餘真實玩家只有 2 個，應以 Eve 與 Frank 補足
        const result = getRecommendedCandidatesPure({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1', 'player_2'],
            lockedNames: ['Alice', 'Bob'],
            sessionPlayers: [
                { id: 'session_p1', name: 'Eve' },
                { id: 'session_p2', name: 'Frank' },
                { id: 'session_p3', name: 'Charlie' } // 已有 Charlie 應排除避免重名
            ]
        });

        expect(result.map(r => r.name)).toEqual(['Charlie', 'David', 'Eve', 'Frank']);
    });
});

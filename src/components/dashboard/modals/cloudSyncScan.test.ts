import { describe, expect, it } from 'vitest';
import { calculateCloudScanStats } from './cloudSyncScan';
import type { CloudFile } from '../../../services/googleDrive';

const cloudFile = (id: string, time: number): CloudFile => ({
    id, name: `Game_with_underscores_${id}`, createdTime: '2026-01-01',
    appProperties: { originalUpdatedAt: String(time) }
});

describe('cloud sync metadata scan', () => {
    it('keeps source-specific timestamp fallbacks and template overrides when comparing both directions', () => {
        const local = { data: {
            templates: [{ id: 'equal', updatedAt: 100 }, { id: 'new-local', updatedAt: 1 }],
            overrides: [{ id: 'override', updatedAt: 101 }],
            sessions: [{ id: 'active', startTime: 100 }, { id: 'changed', startTime: 100, lastUpdatedAt: 101 }],
            history: [{ id: 'history', endTime: 100 }, { id: 'history-changed', endTime: 100, updatedAt: 101 }]
        } };
        const before = JSON.stringify(local);
        expect(calculateCloudScanStats(
            local as any,
            [cloudFile('equal', 100), cloudFile('override', 100), cloudFile('remote', 100)],
            [cloudFile('active', 101), cloudFile('changed', 100), cloudFile('remote-active', 1)],
            [cloudFile('history', 101), cloudFile('history-changed', 100)]
        )).toEqual({
            upload: { templates: 2, sessions: 1, history: 1 },
            download: { templates: 1, sessions: 2, history: 1 }
        });
        expect(JSON.stringify(local)).toBe(before);
    });
});

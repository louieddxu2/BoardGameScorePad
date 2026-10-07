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

    it('retains first-local/last-cloud duplicate precedence and ignores folders without usable IDs', () => {
        const local = { data: {
            templates: [{ id: 'same', updatedAt: 300 }, { id: 'missing-time' }],
            overrides: [{ id: 'same', updatedAt: 100 }],
            sessions: [{ id: 'missing-time' }],
            history: [{ id: 'missing-time' }]
        } };
        expect(calculateCloudScanStats(
            local as any,
            [cloudFile('same', 400), cloudFile('same', 200), cloudFile('missing-time', 10),
                { ...cloudFile('unencoded', 10), name: 'NoSeparator' },
                { ...cloudFile('empty', 10), name: 'Game_' }],
            [cloudFile('missing-time', 10)],
            [cloudFile('missing-time', 10)]
        )).toEqual({
            upload: { templates: 1, sessions: 0, history: 0 },
            download: { templates: 2, sessions: 1, history: 0 }
        });
    });

    it('indexes local IDs once instead of searching every local row for each cloud file', () => {
        const size = 128;
        let idReads = 0;
        const templates = Array.from({ length: size }, (_, index) => ({
            get id() { idReads++; return `game-${index}`; },
            updatedAt: 100
        }));
        expect(calculateCloudScanStats(
            { data: { templates } } as any,
            Array.from({ length: size }, (_, index) => cloudFile(`game-${index}`, 100)), [], []
        )).toEqual({
            upload: { templates: 0, sessions: 0, history: 0 },
            download: { templates: 0, sessions: 0, history: 0 }
        });
        // A small constant allowance keeps this about linear work, not exact implementation details.
        expect(idReads).toBeLessThanOrEqual(size * 3);
    });
});

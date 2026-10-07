import { describe, expect, it } from 'vitest';
import { extractCloudLocalId, getCloudUpdatedAt } from './cloudMetadata';
import type { CloudFile } from './types';

describe('cloud metadata parsing', () => {
    it('uses the final separator and preserves the stricter full-backup name policy', () => {
        const names = ['Game_with_underscores_ab12cd34', 'NoSeparator', '_ab12cd34', '__ab12cd34', 'Game_'];
        expect(names.map(name => [extractCloudLocalId(name), extractCloudLocalId(name, true)])).toEqual([
            ['ab12cd34', 'ab12cd34'], [null, null], ['ab12cd34', null], ['ab12cd34', 'ab12cd34'], ['', '']
        ]);
    });

    it('keeps missing times at zero without converting invalid times into a valid timestamp', () => {
        const file: CloudFile = { id: 'cloud-id', name: 'Game_local-id', createdTime: '2026-01-01' };
        expect(getCloudUpdatedAt(file)).toBe(0);
        expect(getCloudUpdatedAt({ ...file, appProperties: { originalUpdatedAt: '' } })).toBe(0);
        expect(getCloudUpdatedAt({ ...file, appProperties: { originalUpdatedAt: '123' } })).toBe(123);
        expect(getCloudUpdatedAt({ ...file, appProperties: { originalUpdatedAt: 'invalid' } })).toBeNaN();
    });
});

import type { CloudFile } from './types';

/** Folder names end in _localId; game names may contain other underscores. */
export function extractCloudLocalId(name: string, requireName = false): string | null {
    const separator = name.lastIndexOf('_');
    // Full backup historically ignores a separator at the start of the name.
    if (separator === -1 || (requireName && separator === 0)) return null;
    return name.substring(separator + 1);
}

/** Keep missing timestamps at zero and invalid timestamps as NaN for comparisons. */
export function getCloudUpdatedAt(file: CloudFile): number {
    return Number(file.appProperties?.originalUpdatedAt || 0);
}

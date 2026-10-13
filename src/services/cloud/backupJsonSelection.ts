import type { CloudFile } from './types';

type JsonFileCandidate = Pick<CloudFile, 'id' | 'modifiedTime'>;

const modifiedAt = (file: JsonFileCandidate): number => {
    const time = Date.parse(file.modifiedTime || '');
    return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};

/** Shared by backup and restore. Prefer recent JSON, then an immutable ID, never list order. */
export const preferBackupJsonFile = <T extends JsonFileCandidate>(current: T | undefined, candidate: T): T => {
    if (!current) return candidate;
    const currentTime = modifiedAt(current);
    const candidateTime = modifiedAt(candidate);
    return candidateTime > currentTime || (candidateTime === currentTime && candidate.id < current.id)
        ? candidate : current;
};

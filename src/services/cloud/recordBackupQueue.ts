const pendingBackups = new Map<string, Promise<void>>();

/** Serialize whole backups; active/history share record IDs, templates use a separate key prefix. */
export const queueRecordBackup = <T>(recordId: string, backup: () => Promise<T>): Promise<T> => {
    const task = (pendingBackups.get(recordId) ?? Promise.resolve()).then(backup);
    const tail = task.then(() => undefined, () => undefined);
    pendingBackups.set(recordId, tail);
    void tail.then(() => {
        if (pendingBackups.get(recordId) === tail) pendingBackups.delete(recordId);
    });
    return task;
};

/** Re-read only when the queued job starts; a captured UI snapshot may be stale. */
export const latestBackupRecord = async <T>(
    snapshot: T,
    readLatest: () => Promise<T | undefined>,
    version: (record: T) => number,
): Promise<T | undefined> => {
    const stored = await readLatest();
    if (!stored) return undefined; // Deleted/moved records must not be recreated from a snapshot.
    return version(stored) >= version(snapshot) ? stored : snapshot;
};

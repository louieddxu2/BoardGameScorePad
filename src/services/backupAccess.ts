const LOCK_NAME = 'board-game-score-pad:backup';
let zipActive = false;
let driveOperations = 0;

export class BackupInProgressError extends Error {}

/** ZIP operations exclude Drive transfers through their final local writes. Conflicts are never queued. */
export async function withBackupAccess<T>(source: 'zip' | 'drive', task: () => Promise<T>): Promise<T> {
  if (zipActive || (source === 'zip' && driveOperations > 0)) throw new BackupInProgressError();
  if (source === 'zip') zipActive = true;
  else driveOperations++;

  try {
    const locks = globalThis.navigator?.locks;
    if (!locks) return await task();
    return await locks.request(LOCK_NAME, { mode: source === 'zip' ? 'exclusive' : 'shared', ifAvailable: true }, lock => {
      if (!lock) throw new BackupInProgressError();
      return task();
    });
  } finally {
    if (source === 'zip') zipActive = false;
    else driveOperations--;
  }
}

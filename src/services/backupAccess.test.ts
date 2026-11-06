import { afterEach, expect, it, vi } from 'vitest';
import { BackupInProgressError, withBackupAccess } from './backupAccess';

afterEach(() => vi.unstubAllGlobals());

it('requests a shared Drive lock and an exclusive ZIP lock without waiting for other tabs', async () => {
  const request = vi.fn<typeof navigator.locks.request>()
    .mockImplementationOnce((_name, _options, callback) => Promise.resolve(callback(null)))
    .mockImplementation((_name, _options, callback) => Promise.resolve(callback({} as Lock)));
  vi.stubGlobal('navigator', { locks: { request } });
  const task = vi.fn(async () => 'done');

  await expect(withBackupAccess('zip', task)).rejects.toBeInstanceOf(BackupInProgressError);
  expect(task).not.toHaveBeenCalled();
  await expect(withBackupAccess('drive', task)).resolves.toBe('done');
  await expect(withBackupAccess('zip', task)).resolves.toBe('done');
  expect(request.mock.calls.map(([, options]) => options)).toEqual([
    { mode: 'exclusive', ifAvailable: true },
    { mode: 'shared', ifAvailable: true },
    { mode: 'exclusive', ifAvailable: true },
  ]);
  expect(new Set(request.mock.calls.map(([name]) => name)).size).toBe(1);
});

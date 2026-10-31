import { expect, it } from 'vitest';
import { deviceHasNewerRecords, previewBackupRecords } from './preview';
import type { ValidatedBackup } from './validate';

it('lists the newest readable game records of a backup first', () => {
  const backup = { tables: { history: [
    { gameName: 'Older', endTime: 1 }, { gameName: 'Newest', endTime: 3 }, { endTime: 4 }, { gameName: 'Middle', endTime: 2 },
  ] } } as unknown as ValidatedBackup;
  expect(previewBackupRecords(backup, 2)).toEqual({
    total: 4, recent: [{ name: 'Newest', endTime: 3 }, { name: 'Middle', endTime: 2 }],
  });
});

it('flags device records finished after the backup\'s latest record', () => {
  const at = (endTime: number) => ({ total: 1, recent: [{ name: 'Game', endTime }] });
  const none = { total: 0, recent: [] };
  expect(deviceHasNewerRecords(at(2), at(3))).toBe(true);
  expect(deviceHasNewerRecords(at(3), at(3))).toBe(false);
  expect(deviceHasNewerRecords(at(3), at(2))).toBe(false);
  expect(deviceHasNewerRecords(none, at(1))).toBe(true);
  expect(deviceHasNewerRecords(at(1), none)).toBe(false);
});

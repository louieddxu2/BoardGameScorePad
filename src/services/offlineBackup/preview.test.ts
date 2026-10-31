import { expect, it } from 'vitest';
import { previewBackupRecords } from './preview';
import type { ValidatedBackup } from './validate';

it('lists the newest readable game records of a backup first', () => {
  const backup = { tables: { history: [
    { gameName: 'Older', endTime: 1 }, { gameName: 'Newest', endTime: 3 }, { endTime: 4 }, { gameName: 'Middle', endTime: 2 },
  ] } } as unknown as ValidatedBackup;
  expect(previewBackupRecords(backup, 2)).toEqual({
    total: 4, recent: [{ name: 'Newest', endTime: 3 }, { name: 'Middle', endTime: 2 }],
  });
});

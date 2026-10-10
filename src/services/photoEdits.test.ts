import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalImage } from '../types';
import { db } from '../db';
import { saveRotatedPhoto } from './photoEdits';

vi.mock('../db', () => ({ db: {
  transaction: vi.fn(async (_mode, _images, _owner, run) => run()),
  images: { get: vi.fn(), put: vi.fn() },
  sessions: { get: vi.fn(), update: vi.fn() },
  history: { get: vi.fn(), update: vi.fn() },
} }));

const original: LocalImage = {
  id: 'photo', relatedId: 'record', relatedType: 'session',
  blob: new Blob(['original'], { type: 'image/jpeg' }), mimeType: 'image/jpeg', createdAt: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.images.get).mockResolvedValue(original);
  vi.mocked(db.sessions.get).mockResolvedValue({ id: 'record', photoContentIds: { other: 'other-version' } } as any);
  vi.mocked(db.history.get).mockResolvedValue({ id: 'record', photoContentIds: { other: 'other-version' } } as any);
});

describe('stored photo replacement', () => {
  it.each(['session', 'history'] as const)('writes real rotated bytes and only revision/timestamp fields for %s', async ownerType => {
    const rotated = { ...original, blob: new Blob(['physically rotated'], { type: 'image/jpeg' }), contentId: 'new-revision' };
    await saveRotatedPhoto(rotated, undefined, 'record', ownerType);
    expect(db.images.put).toHaveBeenCalledExactlyOnceWith({ ...rotated, rotationSource: undefined, isSynced: false });
    const owner = ownerType === 'history' ? db.history : db.sessions;
    expect(db.transaction).toHaveBeenCalledWith('rw', db.images, owner, expect.any(Function));
    expect(owner.update).toHaveBeenCalledExactlyOnceWith('record', {
      photoContentIds: { other: 'other-version', photo: 'new-revision' },
      [ownerType === 'history' ? 'updatedAt' : 'lastUpdatedAt']: expect.any(Number),
    });
    // Names, scores, notes, photo IDs and ordering are not replaced by a UI snapshot.
    expect(Object.keys(vi.mocked(owner.update).mock.lastCall![1]).sort()).toEqual(
      [ownerType === 'history' ? 'updatedAt' : 'lastUpdatedAt', 'photoContentIds'].sort(),
    );
  });

  it('rejects a stale or reassigned photo without writing either table', async () => {
    const edited = { ...original, contentId: 'next' };
    vi.mocked(db.images.get).mockResolvedValueOnce({ ...original, contentId: 'changed-elsewhere' });
    await expect(saveRotatedPhoto(edited, undefined, 'record', 'session')).rejects.toThrow('changed while rotating');
    vi.mocked(db.images.get).mockResolvedValueOnce({ ...original, relatedId: 'another-record' });
    await expect(saveRotatedPhoto(edited, undefined, 'record', 'session')).rejects.toThrow('no longer available');
    expect(db.images.put).not.toHaveBeenCalled();
    expect(db.sessions.update).not.toHaveBeenCalled();
  });
});

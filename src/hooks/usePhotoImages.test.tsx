import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageService } from '../services/imageService';
import { rotatePhotoBlob } from '../utils/photoRotation';
import type { PhotoContentIds, LocalImage } from '../types';
import { usePhotoImages } from './usePhotoImages';

vi.mock('../services/imageService', () => ({ imageService: { getImage: vi.fn() } }));
vi.mock('../utils/photoRotation', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/photoRotation')>(),
  rotatePhotoBlob: vi.fn(),
}));

const photoIds = ['old', 'new'];
const originals = new Map(photoIds.map(id => [id, new Blob([id], { type: 'image/jpeg' })]));
beforeEach(() => {
  vi.resetAllMocks();
  let count = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:photo-${++count}`) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.mocked(imageService.getImage).mockImplementation(async id => ({ id, blob: originals.get(id)! } as any));
  vi.mocked(rotatePhotoBlob).mockImplementation(async (blob, turns) => turns ? new Blob([`rotated-${turns}`]) : blob);
});

describe('photo URL ownership', () => {
  it('cycles direction from one original, keeps order/IDs, avoids rereads and releases every URL once', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ contentIds }: { contentIds: PhotoContentIds }) => usePhotoImages(photoIds, contentIds),
      { initialProps: { contentIds: {} } },
    );
    await waitFor(() => expect(result.current.images).toHaveLength(2));
    const save = vi.fn(async (_image: LocalImage) => {});
    for (const turns of [1, 2, 3, 0] as const) {
      await act(async () => { await result.current.rotatePhoto('old', save); });
      const saved = save.mock.lastCall![0];
      rerender({ contentIds: { old: saved.contentId! } });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.images.map(image => image.id)).toEqual(['new', 'old']);
      expect(saved.rotationSource?.quarterTurns || 0).toBe(turns);
      if (turns) expect(saved.blob).not.toBe(originals.get('old'));
      else expect(saved.blob).toBe(originals.get('old'));
    }
    expect(imageService.getImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(rotatePhotoBlob).mock.calls.map(([blob, turns]) => [blob, turns])).toEqual([1, 2, 3, 0].map(turns => [originals.get('old'), turns]));
    unmount();
    const created = vi.mocked(URL.createObjectURL).mock.results.map(result => result.value);
    const released = vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url);
    expect(released.sort()).toEqual(created.sort());
  });

  it('keeps the previous visible photo when saving fails, and retries from the same original', async () => {
    const { result } = renderHook(() => usePhotoImages(photoIds));
    await waitFor(() => expect(result.current.images).toHaveLength(2));
    const previous = result.current.images[1];
    const save = vi.fn().mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue(undefined);
    await act(async () => {
      await expect(result.current.rotatePhoto('old', save)).rejects.toThrow('Storage full');
    });
    expect(result.current.images[1]).toBe(previous);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(previous.url);
    await act(async () => { await result.current.rotatePhoto('old', save); });
    expect(save.mock.calls.map(([image]) => image.rotationSource.quarterTurns)).toEqual([1, 1]);
    expect(result.current.images[1].contentId).toBe(save.mock.lastCall![0].contentId);
  });

  it('does not save a rotation after the album closes during rendering', async () => {
    const { result, rerender } = renderHook(({ open }) => usePhotoImages(photoIds, undefined, open), { initialProps: { open: true } });
    await waitFor(() => expect(result.current.images).toHaveLength(2));
    let finish!: (blob: Blob) => void;
    vi.mocked(rotatePhotoBlob).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const save = vi.fn();
    let pending!: Promise<void>;
    act(() => { pending = result.current.rotatePhoto('old', save); });
    rerender({ open: false });
    await act(async () => { finish(new Blob(['rotated'])); await pending; });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.images).toEqual([]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});

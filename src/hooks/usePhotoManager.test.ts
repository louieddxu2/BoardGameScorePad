import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalImage } from '../types';
import { saveRotatedPhoto } from '../services/photoEdits';
import { usePhotoManager } from './usePhotoManager';

vi.mock('../services/photoEdits', () => ({ saveRotatedPhoto: vi.fn(async () => {}) }));
vi.mock('../services/imageService', () => ({ imageService: {} }));

describe('photo rotation persistence', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['unmount', 'replace-context'] as const)('cancels the owner callback after %s even when the original context ID is reused', async action => {
    let commit!: () => void;
    const pending = new Promise<void>(resolve => { commit = resolve; });
    vi.mocked(saveRotatedPhoto).mockImplementationOnce(() => pending);
    const onPhotoRotated = vi.fn();
    const { result, unmount, rerender } = renderHook(({ contextId }) => usePhotoManager({
      contextId, currentPhotoIds: ['photo'],
      onPhotosAdded: vi.fn(), onPhotoDeleted: vi.fn(), onPhotoRotated,
    }), { initialProps: { contextId: 'session' } });
    const image = { id: 'photo', contentId: 'v2', blob: new Blob(['rotated']) } as LocalImage;
    const rotation = result.current.handleRotatePhoto(image, 'v1');
    if (action === 'unmount') unmount();
    else {
      rerender({ contextId: 'other-session' });
      rerender({ contextId: 'session' });
    }
    await act(async () => { commit(); await rotation; });
    expect(saveRotatedPhoto).toHaveBeenCalledOnce();
    expect(onPhotoRotated).not.toHaveBeenCalled();
  });

  it('does not finish rotation until the owning session has adopted its new revision', async () => {
    let commit!: () => void;
    const pending = new Promise<void>(resolve => { commit = resolve; });
    const onPhotoRotated = vi.fn(() => pending);
    const finished = vi.fn();
    const image = { id: 'photo', contentId: 'v2', blob: new Blob(['rotated pixels']) } as LocalImage;
    const { result } = renderHook(() => usePhotoManager({
      contextId: 'session', currentPhotoIds: ['photo'],
      onPhotosAdded: vi.fn(), onPhotoDeleted: vi.fn(), onPhotoRotated,
    }));
    const rotation = result.current.handleRotatePhoto(image, 'v1').then(finished);
    await vi.waitFor(() => expect(onPhotoRotated).toHaveBeenCalledExactlyOnceWith(image));
    expect(saveRotatedPhoto).toHaveBeenCalledExactlyOnceWith(image, 'v1', 'session', 'session');
    expect(finished).not.toHaveBeenCalled();
    await act(async () => { commit(); await rotation; });
    expect(finished).toHaveBeenCalledOnce();
  });
});

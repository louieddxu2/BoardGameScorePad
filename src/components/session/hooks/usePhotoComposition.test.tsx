import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { usePhotoComposition } from './usePhotoComposition';
import type { OverlayData } from '../parts/ScoreOverlayGenerator';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
const data: OverlayData = { gameName: 'Game', date: 1, players: [], winners: [] };
const generator = { current: document.createElement('div') };
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  let count = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:composed-${++count}`) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); });

describe('score photo composition ownership', () => {
  it('captures the prepared background instead of replacing the photo palette with the app background', async () => {
    const node = document.createElement('div');
    node.style.backgroundColor = 'rgb(76, 31, 31)';
    const ref = { current: node };
    vi.mocked(toBlob).mockResolvedValue(new Blob(['composed']));
    renderHook(() => usePhotoComposition(true, 'photo', data, ref, vi.fn()));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(toBlob).toHaveBeenCalledExactlyOnceWith(node, {
      pixelRatio: 1, skipFonts: true, backgroundColor: 'rgb(76, 31, 31)',
    });
  });

  it('waits for the source photo before capture and cancels an obsolete image wait on rotation', async () => {
    const oldImage = document.createElement('img');
    oldImage.dataset.scorePhotoSource = 'true';
    Object.defineProperty(oldImage, 'complete', { value: false });
    const title = document.createElement('h2');
    title.dataset.scorePhotoTitle = 'true';
    const oldRoot = document.createElement('div');
    oldRoot.append(oldImage, title);
    const ref = { current: oldRoot };
    const onError = vi.fn();
    vi.mocked(toBlob).mockResolvedValue(new Blob(['current']));
    const removeListener = vi.spyOn(oldImage, 'removeEventListener');
    const { result, rerender } = renderHook(({ src }) => usePhotoComposition(true, src, data, ref, onError), {
      initialProps: { src: 'original' },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(toBlob).not.toHaveBeenCalled();
    const newImage = document.createElement('img');
    newImage.dataset.scorePhotoSource = 'true';
    Object.defineProperty(newImage, 'complete', { value: false });
    ref.current = document.createElement('div');
    ref.current.append(newImage, title.cloneNode());
    rerender({ src: 'rotated' });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    oldImage.dispatchEvent(new Event('load'));
    expect(toBlob).not.toHaveBeenCalled();
    await act(async () => { newImage.dispatchEvent(new Event('load')); });
    expect(toBlob).toHaveBeenCalledExactlyOnceWith(ref.current, expect.any(Object));
    expect(ref.current.style.getPropertyValue('--photo-title-color')).toBe('#ffffff');
    expect(removeListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(result.current.isGenerating).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('regenerates for a rotated source, ignores late old results and never exposes a stale share image', async () => {
    const pending: Array<(blob: Blob) => void> = [];
    vi.mocked(toBlob).mockImplementation(() => new Promise(resolve => { pending.push(resolve); }));
    const onError = vi.fn();
    const { result, rerender, unmount } = renderHook(({ src }) => usePhotoComposition(true, src, data, generator, onError), { initialProps: { src: 'original' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    rerender({ src: 'rotated' });
    await act(async () => { pending[0](new Blob(['old'])); await vi.advanceTimersByTimeAsync(600); });
    expect(result.current).toEqual({ composedImageUrl: null, isGenerating: true });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () => { pending[1](new Blob(['current'])); });
    expect(result.current).toEqual({ composedImageUrl: 'blob:composed-1', isGenerating: false });
    rerender({ src: 'second-rotation' });
    expect(result.current).toEqual({ composedImageUrl: null, isGenerating: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    unmount();
    await act(async () => { pending[2](new Blob(['unmounted'])); });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:composed-1');
    expect(onError).not.toHaveBeenCalled();
  });

  it('cancels a scheduled generation when scores are hidden and reports a real rendering failure', async () => {
    const onError = vi.fn();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderHook(({ enabled }) => usePhotoComposition(enabled, 'photo', data, generator, onError), { initialProps: { enabled: true } });
    rerender({ enabled: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(toBlob).not.toHaveBeenCalled();
    vi.mocked(toBlob).mockRejectedValue(new Error('Canvas failed'));
    rerender({ enabled: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(onError).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});

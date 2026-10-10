import { afterEach, describe, expect, it, vi } from 'vitest';
import { rotatePhotoBlob } from './photoRotation';
import type { PhotoQuarterTurns } from '../types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mockImage = (fails = false) => {
  vi.stubGlobal('Image', class {
    naturalWidth = 1200;
    naturalHeight = 800;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) { queueMicrotask(() => fails ? this.onerror?.() : this.onload?.()); }
  });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:source') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
};

describe('non-destructive photo rotation', () => {
  it('renders each quarter turn at original resolution and returns the original at zero turns', async () => {
    mockImage();
    const context = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
    const encodedSizes: number[][] = [];
    const source = new Blob(['original'], { type: 'image/jpeg' });
    const output = new Blob(['rendered'], { type: 'image/jpeg' });
    const encoder = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      encodedSizes.push([this.width, this.height]);
      callback(output);
    });
    for (const turns of [1, 2, 3] as PhotoQuarterTurns[]) {
      expect(await rotatePhotoBlob(source, turns)).toBe(output);
    }
    expect(encodedSizes).toEqual([[800, 1200], [1200, 800], [800, 1200]]);
    expect(context.rotate.mock.calls.map(([angle]) => angle)).toEqual([Math.PI / 2, Math.PI, 3 * Math.PI / 2]);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), -600, -400);
    expect(encoder).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.95);
    expect(await rotatePhotoBlob(source, 0)).toBe(source);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('releases the decode URL on failure and does not encode an unreadable original', async () => {
    mockImage(true);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    await expect(rotatePhotoBlob(new Blob(['invalid']), 1)).rejects.toThrow('decoded');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source');
    expect(encode).not.toHaveBeenCalled();
  });
});

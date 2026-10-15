import { describe, expect, it } from 'vitest';
import { getPhotoResultPalette, PHOTO_RESULT_FALLBACK } from './photoResultPalette';

describe('photo result palette', () => {
    it('uses the most common chromatic group rather than averaging unrelated colors or the neutral background', () => {
        const source = new Uint8ClampedArray([
            255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
            20, 160, 30, 255, 25, 170, 35, 255,
            220, 20, 20, 255, 10, 20, 220, 255,
            255, 0, 0, 0, 255, 0, 0, 0,
        ]);
        const before = source.slice();
        const palette = getPhotoResultPalette(source);
        expect(palette.tint).toBe('rgba(127,162,129,0.12)');
        expect(palette.border).toBe('rgba(127,162,129,0.45)');
        expect(source).toEqual(before);
    });

    it('keeps extreme warm and cool photos muted and falls back for monochrome/transparent samples', () => {
        expect(getPhotoResultPalette(new Uint8ClampedArray([255, 0, 0, 255])).tint)
            .toBe('rgba(193,129,129,0.12)');
        expect(getPhotoResultPalette(new Uint8ClampedArray([0, 0, 255, 255])).tint)
            .toBe('rgba(141,141,204,0.12)');
        expect(getPhotoResultPalette(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0])))
            .toEqual(PHOTO_RESULT_FALLBACK);
    });
});

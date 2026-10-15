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
        expect(palette.background).toBe('hsl(124, 44%, 22%)');
        expect(palette.card).toBe('hsl(124, 37%, 30%)');
        expect(palette.border).toBe('hsl(124, 44%, 52%)');
        expect(source).toEqual(before);
    });

    it('gives warm and cool photos distinct opaque surfaces in both themes instead of near-gray transparency', () => {
        for (const [channels, hue] of [[[255, 0, 0], 0], [[0, 0, 255], 240]] as const) {
            const pixels = new Uint8ClampedArray([...channels, 255]);
            const dark = getPhotoResultPalette(pixels, 'dark');
            const light = getPhotoResultPalette(pixels, 'light');
            expect(dark.background).toBe(`hsl(${hue}, 44%, 22%)`);
            expect(dark.card).toBe(`hsl(${hue}, 37%, 30%)`);
            expect(light.background).toBe(`hsl(${hue}, 44%, 92%)`);
            expect(light.card).toBe(`hsl(${hue}, 37%, 96%)`);
            expect(dark.card).not.toBe(dark.background);
            expect(light.card).not.toBe(light.background);
        }
        expect(getPhotoResultPalette(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0])))
            .toEqual(PHOTO_RESULT_FALLBACK);
        expect(getPhotoResultPalette(new Uint8ClampedArray([100, 80, 80, 255, 80, 100, 100, 255])))
            .toEqual(PHOTO_RESULT_FALLBACK);
    });
});

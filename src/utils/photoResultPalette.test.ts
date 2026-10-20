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
        expect(palette.identity).toBe('hsl(124, 37%, 26%)');
        expect(palette.border).toBe('hsl(124, 44%, 52%)');
        expect(source).toEqual(before);
    });

    it('chooses warm and cool surfaces from photo brightness instead of an app-theme parameter', () => {
        for (const [channels, hue] of [[[255, 0, 0], 0], [[0, 0, 255], 240]] as const) {
            const pixels = new Uint8ClampedArray([...channels, 255]);
            const dark = getPhotoResultPalette(pixels);
            const light = getPhotoResultPalette(new Uint8ClampedArray([...channels.map(value => 200 + value * 55 / 255), 255]));
            expect(dark.background).toBe(`hsl(${hue}, 44%, 22%)`);
            expect(dark.card).toBe(`hsl(${hue}, 37%, 30%)`);
            expect(light.background).toBe(`hsl(${hue}, 44%, 92%)`);
            expect(light.card).toBe(`hsl(${hue}, 37%, 96%)`);
            expect(dark.identity).toBe(`hsl(${hue}, 37%, 26%)`);
            expect(light.identity).toBe(`hsl(${hue}, 37%, 92%)`);
            expect(dark.card).not.toBe(dark.background);
            expect(light.card).not.toBe(light.background);
        }
        expect(getPhotoResultPalette(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0])))
            .toEqual(PHOTO_RESULT_FALLBACK);
        expect(getPhotoResultPalette(new Uint8ClampedArray([100, 80, 80, 255, 80, 100, 100, 255])))
            .toEqual(PHOTO_RESULT_FALLBACK);
    });

    it('also selects matching neutral surfaces and text for monochrome photos, ignoring transparent pixels', () => {
        const bright = getPhotoResultPalette(new Uint8ClampedArray([240, 240, 240, 255, 0, 0, 0, 0]));
        expect(bright.background).toBe('#f1f5f9');
        expect(bright.text).toBe('#0f172a');
        expect(bright.identity).toBe('#e8edf2');
        const dark = getPhotoResultPalette(new Uint8ClampedArray([30, 30, 30, 255, 255, 255, 255, 0]));
        expect(dark).toEqual(PHOTO_RESULT_FALLBACK);
        expect(getPhotoResultPalette(new Uint8ClampedArray())).toEqual(PHOTO_RESULT_FALLBACK);
    });
});

import { describe, expect, it } from 'vitest';
import { getPhotoResultPalette, PHOTO_RESULT_FALLBACK } from './photoResultPalette';
import { parseColor } from './color';

const rgb = (color: string) => {
    const { r, g, b } = parseColor(color)!;
    // Exported bitmaps quantize channels to integers; verify that result, too.
    return [r, g, b].map(Math.round);
};
const luminance = (color: string) => rgb(color).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first: string, second: string) => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const pixels = (...colors: number[][]) => new Uint8ClampedArray(colors.flatMap(color => [...color, 255]));

describe('photo result palette', () => {
    it('uses the common chromatic group, ignoring transparent pixels and preserving the source', () => {
        const source = pixels(
            [255, 255, 255], [255, 255, 255], [255, 255, 255],
            [20, 160, 30], [25, 170, 35], [220, 20, 20], [10, 20, 220],
        );
        const before = source.slice();
        const palette = getPhotoResultPalette(new Uint8ClampedArray([...source, 255, 0, 0, 0]));
        const [red, green, blue] = rgb(palette.background);
        expect(green).toBeGreaterThan(red + 20);
        expect(green).toBeGreaterThan(blue + 20);
        expect(palette).toEqual(getPhotoResultPalette(source));
        expect(source).toEqual(before);
    });

    it('follows brightness continuously instead of switching fixed surface presets at 160', () => {
        const backgrounds = [30, 80, 159, 160, 210, 240].map(value =>
            getPhotoResultPalette(pixels([value, value, value])).background);
        expect(backgrounds.map(luminance)).toEqual([...backgrounds].map(luminance).sort((a, b) => a - b));
        expect(rgb(backgrounds[3])[0] - rgb(backgrounds[2])[0]).toBeLessThan(3);
        for (const background of backgrounds) {
            const [red, green, blue] = rgb(background);
            expect(red).toBe(green);
            expect(green).toBe(blue);
        }
        expect(getPhotoResultPalette(pixels([40, 40, 40])).background)
            .not.toBe(getPhotoResultPalette(pixels([80, 80, 80])).background);
    });

    it('does not let one colorful object tint a mostly neutral photo', () => {
        const neutral = Array.from({ length: 100 }, () => [200, 200, 200]);
        const [red, green, blue] = rgb(getPhotoResultPalette(pixels(...neutral, [255, 0, 0])).background);
        expect(Math.max(red, green, blue) - Math.min(red, green, blue)).toBeLessThanOrEqual(5);
        const warm = getPhotoResultPalette(pixels([180, 100, 60]));
        const cool = getPhotoResultPalette(pixels([60, 100, 180]));
        expect(rgb(warm.background)[0]).toBeGreaterThan(rgb(warm.background)[2]);
        expect(rgb(cool.background)[2]).toBeGreaterThan(rgb(cool.background)[0]);
    });

    it.each([40, 240])('separates the attribute backdrop while preserving the score and identity paint at brightness %i', value => {
        const sample = pixels([value, value, value]);
        const original = getPhotoResultPalette(sample);
        const attributes = getPhotoResultPalette(sample, { separateAttributeBackdrop: true });
        expect(attributes).toEqual({ ...original, background: attributes.background });
        expect(contrast(attributes.background, attributes.card)).toBeGreaterThan(contrast(original.background, original.card));
        expect(contrast(attributes.background, attributes.muted)).toBeGreaterThanOrEqual(4.5);
    });

    it('gives a warm tabletop a light footer distinct from the score cards', () => {
        const sample = pixels([166, 154, 112], [168, 155, 114], [165, 151, 113],
            [204, 176, 141], [207, 180, 145], [202, 214, 170], [171, 196, 151]);
        const palette = getPhotoResultPalette(sample);
        const [red, green, blue] = rgb(palette.background);

        expect(red).toBeGreaterThan(green);
        expect(green).toBeGreaterThan(blue + 8);
        expect(luminance(palette.background)).toBeGreaterThan(luminance(palette.card) + 0.15);
        expect(contrast(palette.background, palette.muted)).toBeGreaterThanOrEqual(4.5);
    });

    it('uses middle brightness levels for the footer lift while preserving card paint', () => {
        const dark = [120, 120, 120];
        const even = [150, 150, 150];
        const bright = [240, 240, 240];
        const mixed = getPhotoResultPalette(pixels(dark, dark, dark, bright));
        const uniform = getPhotoResultPalette(pixels(even, even, even, even));

        // Both samples average 150 before trimming.
        expect(mixed).toEqual({ ...uniform, background: mixed.background });
        expect(luminance(uniform.background)).toBeGreaterThan(luminance(mixed.background));
    });

    it.each([false, true])('eases in the footer lift across the ink transition (attributes: %s)', separateAttributeBackdrop => {
        const options = { separateAttributeBackdrop };
        const before = getPhotoResultPalette(pixels([145, 145, 145]), options);
        const after = getPhotoResultPalette(pixels([146, 146, 146]), options);
        const brighter = getPhotoResultPalette(pixels([159, 159, 159]), options);

        expect(before.text).not.toBe(after.text);
        expect(rgb(after.background)[0] - rgb(before.background)[0]).toBeLessThanOrEqual(30);
        expect(rgb(brighter.background)[0] - rgb(after.background)[0]).toBeGreaterThan(30);
    });

    it('keeps text and crowns readable across hues and midtones while keeping identity tones close', () => {
        for (let value = 0; value <= 255; value += 5) {
            for (const color of [[value, value, value], [value, 0, 0], [0, value, 0], [0, 0, value], [value, value, 0]]) {
                const palette = getPhotoResultPalette(pixels(color));
                for (const surface of [palette.background, palette.card, palette.identity]) {
                    expect(contrast(palette.text, surface), `${color}: score`).toBeGreaterThanOrEqual(4.5);
                    expect(contrast(palette.muted, surface), `${color}: caption`).toBeGreaterThanOrEqual(4.5);
                    expect(contrast(palette.winner, surface), `${color}: crown`).toBeGreaterThanOrEqual(3);
                }
                const card = rgb(palette.card);
                const identity = rgb(palette.identity);
                identity.forEach((channel, index) => {
                    expect(channel).toBeLessThan(card[index]);
                    expect(card[index] - channel).toBeLessThan(10);
                });
            }
        }
        expect(getPhotoResultPalette(new Uint8ClampedArray())).toEqual(PHOTO_RESULT_FALLBACK);
        expect(getPhotoResultPalette(new Uint8ClampedArray([255, 0, 0, 0]))).toEqual(PHOTO_RESULT_FALLBACK);
    });
});

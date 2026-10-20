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

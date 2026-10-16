import { afterEach, describe, expect, it } from 'vitest';
import { getPhotoPlayerNameShadow } from './photoTextContrast';
import { getPhotoResultPalette } from './photoResultPalette';

// Independently check the resulting sRGB colors, not just that a shadow property exists.
const luminance = (color: string) => {
    const element = document.createElement('span');
    element.style.color = color;
    const channels = element.style.color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (first: number, second: number) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

afterEach(() => document.documentElement.style.removeProperty('--c-txt-secondary'));

describe('photo name and surface contrast', () => {
    it('keeps neutral scores legible and gives colored names a strong edge even when they match the card', () => {
        for (const channels of [[255, 0, 0], [0, 255, 0], [0, 0, 255]]) {
            for (const bright of [false, true]) {
                const sample = bright ? channels.map(value => 200 + value * 55 / 255) : channels;
                const palette = getPhotoResultPalette(new Uint8ClampedArray([...sample, 255]));
                const text = luminance(palette.text);
                expect(contrast(text, luminance(palette.card))).toBeGreaterThan(4.5);
                expect(contrast(text, luminance(palette.background))).toBeGreaterThan(4.5);
                expect(contrast(luminance(palette.muted), luminance(palette.background))).toBeGreaterThan(4.5);
                expect(contrast(luminance(palette.winner), luminance(palette.card))).toBeGreaterThan(3);
                // Test the difficult case: exactly the same name and card color.
                const element = document.createElement('span');
                element.style.color = palette.card;
                const outline = getPhotoPlayerNameShadow(element.style.color).includes('#ffffff') ? 1 : 0;
                expect(contrast(outline, luminance(palette.card))).toBeGreaterThanOrEqual(4.5);
            }
        }
        for (const color of ['#000000', '#ffffff', '#ff0000', '#00d000', '#0000ff', '#808080', '#ffff00']) {
            const shadow = getPhotoPlayerNameShadow(color);
            const outline = shadow.includes('#ffffff') ? 1 : 0;
            expect(contrast(outline, luminance(color))).toBeGreaterThanOrEqual(4.5);
            expect(shadow).toContain('-1.25px -1.25px 0');
            expect(shadow).toContain('1.25px 1.25px 0');
        }
    });

    it('resolves the actual theme-dependent color for players without a chosen color', () => {
        document.documentElement.style.setProperty('--c-txt-secondary', '203 213 225');
        expect(getPhotoPlayerNameShadow('rgb(var(--c-txt-secondary))')).toContain('#000000');
        document.documentElement.style.setProperty('--c-txt-secondary', '30 41 59');
        expect(getPhotoPlayerNameShadow('rgb(var(--c-txt-secondary))')).toContain('#ffffff');
    });
});

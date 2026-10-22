import { describe, expect, it } from 'vitest';
import { getPhotoPlayerNameStyles } from './photoTextContrast';
import { getPhotoResultPalette } from './photoResultPalette';
import { parseColor } from './color';

// Independently check the resulting sRGB colors, not just that a shadow property exists.
const luminance = (color: string) => {
    const rgb = parseColor(color)!;
    const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (first: number, second: number) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

describe('photo name and surface contrast', () => {
    it('preserves selected ink and uses normal weight without outlines on non-dark plates', () => {
        const original = '#facc15';
        const style = getPhotoPlayerNameStyles(original, '#eee6d8');
        expect(style).toMatchObject({ color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none' });
        expect(style.textShadow).toBe('none');
        expect(getPhotoPlayerNameStyles('#111111', '#eee6d8').color).toBe('#111111');
        expect(getPhotoPlayerNameStyles('transparent', '#eee6d8').color).toBe('transparent');
        expect(getPhotoPlayerNameStyles('#111111', '#111111')).toEqual({
            color: '#111111', fontWeight: 700, textShadow: 'none',
            WebkitTextStroke: 0, filter: 'none',
        });
        for (const background of ['#606060', '#757575', '#767676', '#777777', '#808080', '#a08060']) {
            const name = getPhotoPlayerNameStyles(original, background);
            expect(name).toMatchObject({
                color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none',
            });
            expect(name.textShadow).toBe('none');
        }
        for (const original of ['#ef4444', '#3b82f6', '#10b981']) {
            // Formerly red -> rgb(252,220,220), blue -> rgb(213,228,253).
            expect(getPhotoPlayerNameStyles(original, '#656565')).toMatchObject({
                color: original, fontWeight: 400,
            });
        }
    });

    it('never adjusts player RGB or alpha or adds outlines across photo hues', () => {
        const samples = Array.from({ length: 256 }, (_, value) => [
            [value, value, value], [value, value * 0.65, value * 0.4], [value * 0.4, value * 0.65, value],
        ]).flat();
        for (const sample of samples) {
            const palette = getPhotoResultPalette(new Uint8ClampedArray([...sample, 255]));
            const theme = luminance(palette.identity) <= 0.1 ? 'dark' : 'light';
            for (const color of ['#1f2937', '#facc15', '#ef4444', '#3b82f6', '#ffffff', 'rgba(0,0,0,.4)']) {
                const style = getPhotoPlayerNameStyles(color, palette.identity);
                expect(style.color, `${sample}: ${color}`).toBe(color);
                expect(style).not.toHaveProperty('transition');
                expect(style.fontWeight).toBe(theme === 'dark' ? 700 : 400);
                expect(style.textShadow).toBe('none');
                expect(style.WebkitTextStroke).toBe(0);
            }
        }
    });

    it('keeps automatic scores and result surfaces legible without changing their palette policy', () => {
        for (const channels of [[255, 0, 0], [0, 255, 0], [0, 0, 255]]) {
            for (const bright of [false, true]) {
                const sample = bright ? channels.map(value => 200 + value * 55 / 255) : channels;
                const palette = getPhotoResultPalette(new Uint8ClampedArray([...sample, 255]));
                const text = luminance(palette.text);
                expect(contrast(text, luminance(palette.card))).toBeGreaterThan(4.5);
                expect(contrast(text, luminance(palette.background))).toBeGreaterThan(4.5);
                expect(contrast(luminance(palette.muted), luminance(palette.background))).toBeGreaterThan(4.5);
                expect(contrast(luminance(palette.winner), luminance(palette.card))).toBeGreaterThan(3);
                expect(contrast(luminance(palette.winner), luminance(palette.identity))).toBeGreaterThan(3);
            }
        }
    });

});

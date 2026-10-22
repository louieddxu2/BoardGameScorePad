import { afterEach, describe, expect, it } from 'vitest';
import { getPhotoPlayerNameStyles } from './photoTextContrast';
import { getPhotoResultPalette } from './photoResultPalette';
import { createColorReader, parseColor } from './color';
import { getContrastTextStyles } from './ui';

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

afterEach(() => document.documentElement.style.removeProperty('--test-photo-ink'));

describe('photo name and surface contrast', () => {
    it('preserves selected ink and uses normal-weight edge protection on non-dark plates', () => {
        const original = '#facc15';
        const style = getPhotoPlayerNameStyles(original, '#eee6d8');
        expect(style).toMatchObject({ color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none' });
        expect(style.textShadow).not.toBe('none');
        expect(style.textShadow).not.toContain('1.25px');
        expect(getPhotoPlayerNameStyles('#111111', '#eee6d8').color).toBe('#111111');
        expect(getPhotoPlayerNameStyles('transparent', '#eee6d8').color).toBe('transparent');
        expect(getPhotoPlayerNameStyles('#111111', '#111111')).toEqual({
            color: '#111111', fontWeight: 700, textShadow: getContrastTextStyles('#111111', 'dark').textShadow,
            WebkitTextStroke: '', filter: '',
        });
        for (const background of ['#606060', '#757575', '#767676', '#777777', '#808080', '#a08060']) {
            const name = getPhotoPlayerNameStyles(original, background);
            expect(name).toMatchObject({
                color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none',
            });
            expect(name.textShadow).toBe(getContrastTextStyles(original, 'light', { background }).textShadow);
        }
        for (const original of ['#ef4444', '#3b82f6', '#10b981']) {
            // Formerly red -> rgb(252,220,220), blue -> rgb(213,228,253).
            expect(getPhotoPlayerNameStyles(original, '#656565')).toMatchObject({
                color: original, fontWeight: 400,
            });
        }
    });

    it('never adjusts player RGB or alpha across photo hues and reuses the UI tone policy', () => {
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
                expect(style.textShadow).toBe(getContrastTextStyles(color, theme).textShadow);
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

    it('uses the supplied reader to apply calibrated lightness limits to unregistered CSS colors', () => {
        const color = 'rgb(var(--test-photo-ink))';
        document.documentElement.style.setProperty('--test-photo-ink', '195 195 195');
        expect(getPhotoPlayerNameStyles(color, '#eee', createColorReader()).textShadow).toContain('0.5px 0 0 rgba(0,0,0,0.6)');
        document.documentElement.style.setProperty('--test-photo-ink', '126 126 126');
        expect(getPhotoPlayerNameStyles(color, '#111', createColorReader()).textShadow).toContain('rgba(255,255,255,0.7)');
    });

    it('does not promote neutral palette colors to outlined ink even when they match the backing', () => {
        for (const color of ['rgb(var(--c-p-red))', 'rgb(var(--c-p-blue))', '#ef4444', '#3b82f6']) {
            for (const background of ['#111', '#eee', '#ef4444', '#3b82f6']) {
                const style = getPhotoPlayerNameStyles(color, background);
                expect(style.color).toBe(color);
                expect(style.textShadow).not.toContain('0 rgba(');
            }
        }
        expect(getPhotoPlayerNameStyles('rgb(var(--c-p-white))', '#eee').textShadow).toContain('0 rgba(0,0,0,0.6)');
        expect(getPhotoPlayerNameStyles('rgb(var(--c-p-black))', '#111').textShadow).toContain('0 rgba(255,255,255,0.7)');
    });
});

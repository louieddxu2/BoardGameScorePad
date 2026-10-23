import { describe, expect, it } from 'vitest';
import { getPhotoPlayerNameStyles } from './photoTextContrast';
import { getPhotoResultPalette } from './photoResultPalette';
import { parseColor } from './color';
import { getPhotoNamePlateBackground } from './photoNamePlate';

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
    it('scales the white-only scoreboard edge without changing selected ink or adding weight', () => {
        const original = '#ffffff';
        const style = getPhotoPlayerNameStyles(original, '#eee6d8');
        expect(style).toMatchObject({ color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none' });
        expect(style.textShadow).toBe('3px 0 0 rgba(0,0,0,1), -3px 0 0 rgba(0,0,0,1), 0 3px 0 rgba(0,0,0,1), 0 -3px 0 rgba(0,0,0,1)');
        expect(getPhotoPlayerNameStyles('#111111', '#eee6d8').color).toBe('#111111');
        expect(getPhotoPlayerNameStyles('transparent', '#eee6d8').color).toBe('transparent');
        expect(getPhotoPlayerNameStyles('#111111', '#111111')).toMatchObject({
            color: '#111111', fontWeight: 700,
            WebkitTextStroke: 0, filter: 'none',
        });
        for (const background of ['#606060', '#757575', '#767676', '#777777', '#808080', '#a08060']) {
            const name = getPhotoPlayerNameStyles(original, background);
            expect(name).toMatchObject({
                color: original, fontWeight: 400, WebkitTextStroke: 0, filter: 'none',
            });
            expect(name.textShadow).toBe(style.textShadow);
        }
        for (const original of ['#ef4444', '#3b82f6', '#10b981']) {
            // Formerly red -> rgb(252,220,220), blue -> rgb(213,228,253).
            expect(getPhotoPlayerNameStyles(original, '#656565')).toMatchObject({
                color: original, fontWeight: 400,
            });
        }
    });

    it('keeps selected RGB/alpha and the matching scoreboard treatment independently of the app theme', () => {
        const originalTheme = document.documentElement.getAttribute('data-theme');
        try {
            for (const theme of ['dark', 'light', 'sage']) {
                document.documentElement.setAttribute('data-theme', theme);
                for (const color of ['#1f2937', '#facc15', '#fed7aa', '#ef4444', '#3b82f6', '#ffffff', 'rgba(0,0,0,.4)']) {
                    const style = getPhotoPlayerNameStyles(color, getPhotoNamePlateBackground(color));
                    expect(style.color).toBe(color);
                    expect(style).not.toHaveProperty('transition');
                    expect(style.fontWeight).toBe(400);
                    expect(style.WebkitTextStroke).toBe(0);
                    expect(style.textShadow).not.toContain('rgba(255,255,255');
                    if (color === '#ffffff') {
                        expect(style.textShadow).toContain('3px 0 0 rgba(0,0,0,1)');
                    } else if (color === '#facc15' || color === '#fed7aa') {
                        expect(style.textShadow).toBe('none');
                    } else {
                        expect(style.textShadow).toBe('0 1.5px 3px rgba(0,0,0,0.05)');
                    }
                    const darkStyle = getPhotoPlayerNameStyles(color, getPhotoNamePlateBackground(color, undefined, 'dark'));
                    expect(darkStyle).toMatchObject({ color, fontWeight: 700, WebkitTextStroke: 0, filter: 'none' });
                    if (color === '#1f2937' || color === 'rgba(0,0,0,.4)') {
                        expect(darkStyle.textShadow).toContain('3px 3px 0 rgba(255,255,255,0.7)');
                    } else {
                        expect(darkStyle.textShadow).toBe('0 3px 6px rgba(0,0,0,0.8)');
                    }
                }
            }
        } finally {
            if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', originalTheme);
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

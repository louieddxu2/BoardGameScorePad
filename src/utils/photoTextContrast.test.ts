import { afterEach, describe, expect, it } from 'vitest';
import { getPhotoPlayerNameShadow, getPhotoPlayerNameStyles } from './photoTextContrast';
import { getPhotoResultPalette } from './photoResultPalette';
import { compositeColors, contrastOnBackground } from './colorContrast';
import { parseColor, type RgbaColor } from './color';

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
    it('uses clean readable same-hue ink on light photo plates and keeps dark-photo protection unchanged', () => {
        const original = '#facc15';
        const style = getPhotoPlayerNameStyles(original, '#eee6d8');
        expect(style).toMatchObject({ textShadow: 'none', WebkitTextStroke: 0, filter: 'none' });
        expect(style.color).not.toBe(original);
        expect(contrast(luminance(style.color!), luminance('#eee6d8'))).toBeGreaterThanOrEqual(4.5);
        expect(getPhotoPlayerNameStyles('#111111', '#eee6d8').color).toBe('#111111');
        expect(getPhotoPlayerNameStyles('transparent', '#eee6d8').color).toBe('transparent');
        expect(getPhotoPlayerNameStyles('#111111', '#111111')).toEqual({
            color: '#111111', textShadow: getPhotoPlayerNameShadow('#111111', '#111111'),
            WebkitTextStroke: '', filter: '',
        });
        for (const background of ['#757575', '#767676', '#777777', '#808080', '#a08060']) {
            expect(getPhotoPlayerNameStyles(original, background)).toEqual({
                color: original, textShadow: getPhotoPlayerNameShadow(original, background),
                WebkitTextStroke: '', filter: '',
            });
        }
        let previous = parseColor(original)!;
        for (let value = 117; value <= 255; value++) {
            const next = parseColor(getPhotoPlayerNameStyles(original, `rgb(${value},${value},${value})`).color!)!;
            // The previous black/white crossover changed yellow by over 200 channels at once.
            expect(Math.max(Math.abs(next.r - previous.r), Math.abs(next.g - previous.g), Math.abs(next.b - previous.b)))
                .toBeLessThanOrEqual(8);
            previous = next;
        }
    });

    it('keeps every unoutlined name readable after photo palette and alpha are quantized for export', () => {
        const round = (color: RgbaColor): RgbaColor => ({
            r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: color.a,
        });
        for (let value = 0; value <= 255; value++) {
            const palette = getPhotoResultPalette(new Uint8ClampedArray([value, value, value, 255]));
            const background = parseColor(palette.identity)!;
            for (const color of ['#1f2937', '#facc15', '#ef4444', '#ffffff', 'rgba(0,0,0,.4)']) {
                const style = getPhotoPlayerNameStyles(color, palette.identity);
                if (style.textShadow !== 'none') continue;
                const ink = parseColor(style.color!)!;
                expect(contrastOnBackground(ink, background), `${value}: ${color} CSS`).toBeGreaterThanOrEqual(4.5);
                const paint = round(compositeColors(ink, background));
                expect(contrastOnBackground(paint, round(background)), `${value}: ${color} bitmap`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

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
                expect(contrast(luminance(palette.winner), luminance(palette.identity))).toBeGreaterThan(3);
                // Test the difficult case: exactly the same name and identity color.
                const element = document.createElement('span');
                element.style.color = palette.identity;
                const outline = getPhotoPlayerNameShadow(element.style.color, palette.identity).includes('#ffffff') ? 1 : 0;
                expect(contrast(outline, luminance(palette.identity))).toBeGreaterThanOrEqual(4.5);
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

    it('removes unnecessary outlines and uses the actual backing and alpha to protect low-contrast names', () => {
        expect(getPhotoPlayerNameShadow('#111111', '#eeeeee')).toBe('none');
        expect(getPhotoPlayerNameShadow('#eeeeee', '#111111')).toBe('none');
        expect(getPhotoPlayerNameShadow('#888888', '#ffffff')).toContain('-0.5px -0.5px');
        expect(getPhotoPlayerNameShadow('#aaaaaa', '#ffffff')).toContain('-0.85px -0.85px');
        expect(getPhotoPlayerNameShadow('#ffffff', '#ffffff')).toContain('-1.25px -1.25px 0 #000000');
        expect(getPhotoPlayerNameShadow('#111111', '#111111')).toContain('-1.25px -1.25px 0 #ffffff');
        expect(getPhotoPlayerNameShadow('rgba(0,0,0,0.1)', '#ffffff')).toContain('0 #000000');
        expect(getPhotoPlayerNameShadow('rgb(var(--missing))', '#ffffff')).toContain('1.25px');
    });
});

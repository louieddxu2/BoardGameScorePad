import { expect, it, vi } from 'vitest';
import { COLOR_TONES } from '../colors';
import appCss from '../index.css?raw';
import { createColorReader, parseColor } from './color';
import { getPhotoNamePlateBackground, getPhotoNameRequiredGap } from './photoNamePlate';
import { getOklabLightness } from './textColorTone';

const palette = Object.entries(COLOR_TONES).map(([name, tone]) => {
    const channels = appCss.match(new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+);`))!.slice(1).map(Number);
    return { name, tone, color: `rgb(${channels.join(',')})` };
});

it('calibrates the gap to all 51 existing tinted-header decisions, not a contrast-ratio threshold', () => {
    const blocks = [...appCss.matchAll(/(?::root|html\[data-theme='(?:light|sage)'\])\s*\{([^}]*)\}/g)];
    const themes = blocks.map(match => match[1]).filter(block => block.includes('--c-grid-cell-bg:'));
    expect(themes).toHaveLength(3);
    expect(getOklabLightness(parseColor('#000')!)).toBe(0);
    expect(getOklabLightness(parseColor('#fff')!)).toBeCloseTo(1, 6);
    expect(getPhotoNameRequiredGap(0.26)).toBeCloseTo(0.3343, 6);
    expect(getPhotoNameRequiredGap(0.98)).toBeCloseTo(0.1614, 6);
    expect(getPhotoNameRequiredGap(0.6)).toBeCloseTo(0.25265, 5);
    for (const [index, block] of themes.entries()) {
        const base = parseColor(`rgb(${block.match(/--c-grid-cell-bg:\s*([\d ]+);/)![1]})`)!;
        const alpha = Number(block.match(/--player-surface-tint-opacity:\s*([\d.]+);/)![1]);
        for (const { name, color, tone } of palette) {
            const ink = parseColor(color)!;
            const backing = {
                r: base.r * (1 - alpha) + ink.r * alpha,
                g: base.g * (1 - alpha) + ink.g * alpha,
                b: base.b * (1 - alpha) + ink.b * alpha, a: 1,
            };
            const bgL = getOklabLightness(backing);
            const gap = Math.abs(getOklabLightness(ink) - bgL);
            expect(gap < getPhotoNameRequiredGap(bgL), `${index}: ${name}`)
                .toBe(tone === (index === 0 ? 'dark' : 'light'));
        }
    }
});

it('gives every preset color a passing opaque 8-bit plate across dark, light and colored backgrounds', () => {
    const backgrounds = Array.from({ length: 256 }, (_, value) => `rgb(${value},${value},${value})`);
    backgrounds.push(...palette.map(entry => entry.color), 'rgba(44, 88, 132, 1)', 'transparent', 'inherit');
    for (const { color } of palette) {
        const ink = parseColor(color)!;
        for (const background of backgrounds) {
            const result = getPhotoNamePlateBackground(color, background);
            const backing = parseColor(result)!;
            expect(backing.a).toBe(1);
            const rounded = { ...backing, r: Math.round(backing.r), g: Math.round(backing.g), b: Math.round(backing.b) };
            for (const paint of [backing, rounded]) {
                const bgL = getOklabLightness(paint);
                expect(Math.abs(getOklabLightness(ink) - bgL), `${color} on ${background}`)
                    .toBeGreaterThanOrEqual(getPhotoNameRequiredGap(bgL));
            }
        }
    }
    expect(getPhotoNamePlateBackground('#111111', '#eee6d8')).toBe('#eee6d8');
    expect(getPhotoNamePlateBackground('#ffffff', '#111111')).toBe('#111111');
    // A close match should receive a tinted adjustment, not an immediate black/white fallback.
    const adjusted = parseColor(getPhotoNamePlateBackground('#3b82f6', '#3b82f6'))!;
    expect(adjusted.r === adjusted.g && adjusted.g === adjusted.b).toBe(false);
});

it('shares CSS reads, retains unusual/transparent ink, and always terminates for imported colors', () => {
    document.documentElement.style.setProperty('--test-photo-ink', '255 255 255');
    const computed = vi.spyOn(globalThis, 'getComputedStyle');
    try {
        const read = createColorReader();
        const result = getPhotoNamePlateBackground('rgb(var(--test-photo-ink))', '#eee', read);
        expect(result).toBe(getPhotoNamePlateBackground('#fff', '#eee', read));
        getPhotoNamePlateBackground('rgb(var(--test-photo-ink))', '#111', read);
        expect(computed).toHaveBeenCalledTimes(1);
        expect(getPhotoNamePlateBackground('transparent', '#123456')).toBe('#123456');
        expect(getPhotoNamePlateBackground('unknown-color', '#123456')).toBe('#123456');
        const alpha = { r: 0, g: 0, b: 0, a: 0.01 };
        const snapshot = { ...alpha };
        const importedRead = (color: string) => color === 'imported' ? alpha : parseColor(color);
        expect(parseColor(getPhotoNamePlateBackground('imported', '#888', importedRead))!.a).toBe(1);
        expect(alpha).toEqual(snapshot);
    } finally {
        computed.mockRestore();
        document.documentElement.style.removeProperty('--test-photo-ink');
    }
});

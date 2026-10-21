import { afterEach, describe, expect, it, vi } from 'vitest';
import { createColorReader, parseColor, withColorOpacity } from './color';
import { compositeColors, contrastOnBackground, getSolidTextChoice } from './colorContrast';
import { getContrastTextStyles, getPerceivedLuminance, isColorDark } from './ui';

afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--test-color');
    document.documentElement.style.removeProperty('--test-alias');
});

describe('Color normalization', () => {
    it.each([
        { name: 'opaque black', values: ['#000', '#000f', '#000000', '#000000ff', 'black'], expected: { r: 0, g: 0, b: 0, a: 1 } },
        { name: 'opaque white', values: ['#fff', 'white', 'rgb(100% 100% 100%)', 'rgba(255,255,255,1)'], expected: { r: 255, g: 255, b: 255, a: 1 } },
        { name: 'translucent red', values: ['rgba(255,0,0,.25)', 'rgb(100% 0% 0% / 25%)', 'hsl(1turn 100% 50% / .25)'], expected: { r: 255, g: 0, b: 0, a: 0.25 } },
    ])('normalizes equivalent representations of $name', ({ values, expected }) => {
        for (const value of values) expect(parseColor(value), value).toEqual(expected);
    });

    it('retains alpha from short and long hex instead of treating the color as unknown', () => {
        expect(parseColor('#08f8')).toEqual({ r: 0, g: 136, b: 255, a: 136 / 255 });
        expect(parseColor('#0088ff88')).toEqual(parseColor('#08f8'));
        expect(isColorDark('#000000ff')).toBe(true);
        expect(getPerceivedLuminance('rgb(100% 100% 100%)')).toBe(255);
    });

    it('rejects malformed, unsupported and unresolved values rather than partially parsing them', () => {
        for (const value of ['#ffgg00', '#12345', 'rgb(1,2)', 'rgb(1,,3)', 'rgb(1,2,3 / .5)', 'rgb(1 2 3 / nope)',
            'inherit', 'currentColor', 'not-a-color', 'rgb(var(--missing))', 'rgb(1 2 3) trailing']) {
            expect(parseColor(value), value).toBeNull();
        }
        expect(getPerceivedLuminance(undefined as unknown as string)).toBe(128);
    });

    it('resolves nested variables, fallbacks and channels without losing explicit alpha', () => {
        const values: Record<string, string> = { '--Ink': 'var(--channels)', '--channels': '10 20 30' };
        expect(parseColor('rgb(var(--Ink) / 50%)', name => values[name])).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
        expect(parseColor('var(--missing, var(--other, #fff))')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
        expect(parseColor('var(--loop)', () => 'var(--loop)')).toBeNull();
    });

    it('reads CSS once per operation and does not retain stale values for the next theme', () => {
        document.documentElement.style.setProperty('--test-color', '10 20 30');
        document.documentElement.style.setProperty('--test-alias', 'var(--test-color)');
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        const read = createColorReader();
        expect(read('#fff')).toEqual(parseColor('#fff'));
        expect(computed).not.toHaveBeenCalled();
        expect(read('rgb(var(--test-color))')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
        expect(read('rgb(var(--test-alias))')).toEqual(read('rgb(var(--test-color))'));
        expect(computed).toHaveBeenCalledTimes(1);
        document.documentElement.style.setProperty('--test-color', '200 210 220');
        expect(createColorReader()('rgb(var(--test-color))')).toEqual({ r: 200, g: 210, b: 220, a: 1 });
        expect(computed).toHaveBeenCalledTimes(2);
    });
});

describe('Opacity and solid-background contrast', () => {
    it('generates live variable tints without DOM reads and multiplies existing opacity', () => {
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        expect(withColorOpacity('rgb(var(--c-p-emerald))', 32 / 255)).toBe('rgb(var(--c-p-emerald) / 0.12549)');
        expect(withColorOpacity('rgb(var(--c-p-emerald) / 50%)', 0.5)).toBe('rgb(var(--c-p-emerald) / 0.25)');
        expect(withColorOpacity('rgba(10,20,30,.4)', 0.5)).toBe('rgba(10, 20, 30, 0.2)');
        expect(withColorOpacity('not-a-color', 0.5)).toBeUndefined();
        expect(computed).not.toHaveBeenCalled();
        document.documentElement.style.setProperty('--test-color', '10 20 30 / 0.4');
        expect(withColorOpacity('rgb(var(--test-color))', 0.5)).toBe('rgba(10, 20, 30, 0.2)');
        expect(computed).toHaveBeenCalledTimes(1);
    });

    it('composes paint before contrast evaluation and requires an opaque backing', () => {
        expect(compositeColors(parseColor('rgba(255,0,0,.5)')!, parseColor('#fff')!))
            .toEqual({ r: 255, g: 127.5, b: 127.5, a: 1 });
        expect(compositeColors(parseColor('transparent')!, parseColor('transparent')!))
            .toEqual({ r: 0, g: 0, b: 0, a: 0 });
        expect(contrastOnBackground(parseColor('#fff')!, parseColor('transparent')!)).toBeNull();
        expect(contrastOnBackground(parseColor('#fff')!, parseColor('#000')!)).toBe(21);
        expect(getSolidTextChoice('transparent')).toBeNull();
        expect(getSolidTextChoice('transparent', { backdrop: '#fff' })).toBe('dark');
        expect(getSolidTextChoice('rgba(255,255,255,.1)', { backdrop: '#000' })).toBe('light');
    });

    it('keeps theme-controlled tint strength live and multiplies existing alpha without style reads', () => {
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        const opacity = 'var(--player-surface-tint-opacity)';
        expect(withColorOpacity('rgb(var(--c-p-blue))', opacity)).toBe(`rgb(var(--c-p-blue) / ${opacity})`);
        expect(withColorOpacity('rgb(var(--c-p-blue) / 40%)', opacity)).toBe(`rgb(var(--c-p-blue) / calc(0.4 * ${opacity}))`);
        expect(withColorOpacity('#ff000080', opacity)).toBe(`rgb(255 0 0 / calc(0.501961 * ${opacity}))`);
        expect(withColorOpacity('rgba(10,20,30,.4)', opacity)).toBe(`rgb(10 20 30 / calc(0.4 * ${opacity}))`);
        expect(withColorOpacity('not-a-color', opacity)).toBeUndefined();
        expect(withColorOpacity('#fff', 'var(--missing) trailing' as typeof opacity)).toBeUndefined();
        expect(computed).not.toHaveBeenCalled();
    });

    it('compares the supplied foregrounds rather than tone names or the application theme label', () => {
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        expect(getSolidTextChoice('#10b981')).toBe('dark');
        expect(getSolidTextChoice('#16352f')).toBe('light');
        expect(getSolidTextChoice('#fff', { colors: { dark: '#fff', light: '#000' } })).toBe('light');
        expect(computed).not.toHaveBeenCalled();
    });

    it('preserves the existing ink-outline policy and its no-DOM palette fast path', () => {
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        expect(getContrastTextStyles('rgb(var(--c-p-black))', 'dark').textShadow).toContain('rgba(255,255,255,0.7)');
        expect(getContrastTextStyles('rgb(var(--c-p-yellow))', 'light').textShadow).toContain('rgba(0,0,0,0.6)');
        expect(getContrastTextStyles('rgb(var(--c-p-emerald))', 'light').textShadow).toBe('0 0.5px 1px rgba(0,0,0,0.05)');
        expect(computed).not.toHaveBeenCalled();
    });

    it('uses clean same-hue label ink on light surfaces and shares the grid color reader', () => {
        document.documentElement.style.setProperty('--test-color', '249 115 22');
        const read = createColorReader();
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        const options = { cleanOnLight: true, background: '#f5f4f0', read };
        const orange = getContrastTextStyles('rgb(var(--test-color))', 'light', options);
        expect(orange).toMatchObject({ textShadow: 'none', WebkitTextStroke: 0, filter: 'none' });
        const ink = parseColor(orange.color!)!;
        expect(contrastOnBackground(ink, parseColor(options.background)!)).toBeGreaterThanOrEqual(4.5);
        expect(ink.g / ink.r).toBeCloseTo(115 / 249, 2);
        expect(ink.b / ink.r).toBeCloseTo(22 / 249, 2);
        expect(getContrastTextStyles('#f97316', 'sage', options)).toEqual(orange);
        expect(getContrastTextStyles('#222', 'light', options)).not.toHaveProperty('color');
        expect(getContrastTextStyles('transparent', 'light', options)).not.toHaveProperty('color');
        expect(computed).toHaveBeenCalledTimes(1);
    });

    it('adapts translucent labels against the actual backing without affecting dark, textured or numeric ink', () => {
        const options = { cleanOnLight: true, background: 'rgba(255,0,0,.04)', backdrop: '#fff' };
        const background = compositeColors(parseColor(options.background)!, parseColor(options.backdrop)!);
        for (const color of ['#fff', '#eab308', 'rgba(0,255,0,.15)']) {
            const style = getContrastTextStyles(color, 'light', options);
            expect(style.textShadow).toBe('none');
            expect(contrastOnBackground(parseColor(style.color!)!, background)).toBeGreaterThanOrEqual(4.5);
        }
        expect(getContrastTextStyles('#fff', 'light', { ...options, background: 'inherit' })).not.toHaveProperty('color');
        expect(getContrastTextStyles('#fff', 'light', { cleanOnLight: true, background: 'transparent' })).not.toHaveProperty('color');
        expect(getContrastTextStyles('#222', 'light', { cleanOnLight: true, background: '#111' }).color).toBeDefined();
        expect(getContrastTextStyles('#fff', 'dark', options)).toEqual(getContrastTextStyles('#fff', 'dark'));
        expect(getContrastTextStyles('#fff', 'light', { ...options, isTextureMode: true }))
            .toEqual(getContrastTextStyles('#fff', 'light', { isTextureMode: true }));
        expect(getContrastTextStyles('#fff', 'light').textShadow).toContain('rgba(0,0,0,0.6)');
    });

    it('composites header tints while leaving unknown backgrounds and textured or dark ink unchanged', () => {
        const options = { background: 'rgba(0,0,0,.9)', backdrop: '#fff' };
        expect(getContrastTextStyles('#222', 'light', options).textShadow).toContain('rgba(200,200,200,0.8)');
        expect(getContrastTextStyles('transparent', 'light', options).textShadow).toBe('none');
        for (const theme of ['dark', 'light'] as const) {
            const texture = { isTextureMode: true };
            expect(getContrastTextStyles('#222', theme, { ...options, ...texture }))
                .toEqual(getContrastTextStyles('#222', theme, texture));
        }
        expect(getContrastTextStyles('#222', 'dark', options)).toEqual(getContrastTextStyles('#222', 'dark'));
        expect(getContrastTextStyles('#fff', 'light', { background: 'inherit' }))
            .toEqual(getContrastTextStyles('#fff', 'light'));
        expect(getContrastTextStyles('#fff', 'light', { background: 'transparent' }))
            .toEqual(getContrastTextStyles('#fff', 'light'));
    });
});

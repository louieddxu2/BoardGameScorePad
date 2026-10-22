import { afterEach, describe, expect, it, vi } from 'vitest';
import { createColorReader, parseColor, withColorOpacity } from './color';
import { compositeColors, contrastOnBackground, getSolidTextChoice } from './colorContrast';
import { getContrastTextStyles, getPerceivedLuminance, isColorDark } from './ui';
import { COLOR_TONES } from '../colors';
import appCss from '../index.css?raw';
import { getTextColorTone } from './textColorTone';

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
        expect(getContrastTextStyles('rgb(var(--c-p-yellow))', 'light').textShadow).toBe('none');
        expect(getContrastTextStyles('rgb(var(--c-p-skin))', 'light').textShadow).toBe('none');
        expect(getContrastTextStyles('rgb(var(--c-p-white))', 'light').textShadow)
            .toBe('1px 0 0 rgba(0,0,0,1), -1px 0 0 rgba(0,0,0,1), 0 1px 0 rgba(0,0,0,1), 0 -1px 0 rgba(0,0,0,1)');
        expect(getContrastTextStyles('rgb(var(--c-p-emerald))', 'light').textShadow).toBe('0 0.5px 1px rgba(0,0,0,0.05)');
        expect(getContrastTextStyles('rgb(var(--c-p-emerald))', 'light').fontWeight).toBe(400);
        expect(getContrastTextStyles('rgb(var(--c-p-emerald))', 'dark')).not.toHaveProperty('fontWeight');
        expect(computed).not.toHaveBeenCalled();
        for (const color of ['rgb(var(--c-txt-primary))', 'rgb(var(--c-status-danger))',
            'rgb(var(--c-brand-primary))', 'var(--input-context-ink, #fff)', 'inherit']) {
            expect(getContrastTextStyles(color, 'light')).not.toHaveProperty('fontWeight');
        }
    });

    it('preserves selected label ink and shares the color reader for unregistered colors', () => {
        document.documentElement.style.setProperty('--test-color', '249 115 22');
        const read = createColorReader();
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        const options = { background: '#f5f4f0', read };
        const orange = getContrastTextStyles('rgb(var(--test-color))', 'light', options);
        expect(orange).not.toHaveProperty('color');
        expect(orange.fontWeight).toBe(400);
        expect(orange.textShadow).not.toBe('none');
        expect(getContrastTextStyles('#f97316', 'sage', options)).toEqual(orange);
        expect(getContrastTextStyles('#222', 'light', options)).not.toHaveProperty('color');
        expect(getContrastTextStyles('transparent', 'light', options)).not.toHaveProperty('color');
        expect(computed).toHaveBeenCalledTimes(1);
    });

    it('never replaces custom RGB or alpha in any theme', () => {
        const options = { background: 'rgba(255,0,0,.04)', backdrop: '#fff' };
        for (const color of ['#fff', '#eab308', '#ef4444', '#3b82f6', 'rgba(0,255,0,.15)', 'transparent']) {
            for (const theme of ['dark', 'light', 'sage'] as const) {
                const style = getContrastTextStyles(color, theme, options);
                expect(style).not.toHaveProperty('color');
                if (color !== 'transparent') expect(style.fontWeight).toBe(theme === 'dark' ? undefined : 400);
                if (color !== 'transparent') expect(style.textShadow).not.toBe('none');
            }
        }
        expect(getContrastTextStyles('#fff', 'light', { ...options, background: 'inherit' })).not.toHaveProperty('color');
        expect(getContrastTextStyles('#fff', 'light', { background: 'transparent' })).not.toHaveProperty('color');
        expect(getContrastTextStyles('#222', 'light', { background: '#111' })).not.toHaveProperty('color');
        expect(getContrastTextStyles('#fff', 'dark', options)).toEqual(getContrastTextStyles('#fff', 'dark'));
        expect(getContrastTextStyles('#fff', 'light', { ...options, isTextureMode: true }))
            .toEqual(getContrastTextStyles('#fff', 'light', { isTextureMode: true }));
        expect(getContrastTextStyles('#fff', 'light').textShadow).toContain('rgba(0,0,0,1)');
    });

    it('honors tone categories and calibrated Oklab boundaries, independently of the background', () => {
        const thinBlackEdge = '0.5px 0 0 rgba(0,0,0,0.6), -0.5px 0 0 rgba(0,0,0,0.6), 0 0.5px 0 rgba(0,0,0,0.6), 0 -0.5px 0 rgba(0,0,0,0.6)';
        for (const color of ['yellow', 'skin']) {
            expect(getContrastTextStyles(`rgb(var(--c-p-${color}))`, 'light').textShadow).toBe('none');
        }
        for (const [name] of Object.entries(COLOR_TONES).filter(([, tone]) => tone !== 'light')) {
            expect(getContrastTextStyles(`rgb(var(${name}))`, 'light').textShadow)
                .toBe('0 0.5px 1px rgba(0,0,0,0.05)');
        }
        expect(getContrastTextStyles('#c2c2c2', 'light').textShadow).not.toBe(thinBlackEdge);
        expect(getContrastTextStyles('#c3c3c3', 'light').textShadow).toBe(thinBlackEdge);
        expect(getContrastTextStyles('#7e7e7e', 'dark').textShadow).toContain('rgba(255,255,255,0.7)');
        expect(getContrastTextStyles('#7f7f7f', 'dark').textShadow).toBe('0 1px 2px rgba(0,0,0,0.8)');
        for (const theme of ['dark', 'light', 'sage'] as const) {
            for (const color of ['#222', '#ef4444', '#3b82f6', '#fff', 'rgba(255,255,255,.1)', 'transparent']) {
                for (const background of ['#fff', '#111', 'rgba(0,0,0,.9)', 'inherit', 'transparent']) {
                    expect(getContrastTextStyles(color, theme, { background, backdrop: '#fff' }))
                        .toEqual(getContrastTextStyles(color, theme));
                }
            }
            const texture = { isTextureMode: true };
            expect(getContrastTextStyles('#222', theme, texture)).not.toHaveProperty('fontWeight');
        }
        const read = vi.fn();
        for (const color of ['white', 'yellow', 'skin']) {
            getContrastTextStyles(`rgb(var(--c-p-${color}))`, 'light', { background: 'rgb(var(--unused))', read });
        }
        expect(read).not.toHaveBeenCalled();
    });

    it('reproduces every existing palette label for raw RGB/HEX without changing texture or semantic ink', () => {
        const computed = vi.spyOn(globalThis, 'getComputedStyle');
        for (const [name, tone] of Object.entries(COLOR_TONES)) {
            const channels = appCss.match(new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+);`))!.slice(1).map(Number);
            const rgb = `rgb(${channels.join(',')})`;
            const hex = `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
            expect(getTextColorTone(parseColor(rgb)), name).toBe(tone);
            for (const theme of ['dark', 'light', 'sage'] as const) {
                expect(getContrastTextStyles(rgb, theme), `${name}: ${theme}`)
                    .toEqual(getContrastTextStyles(`rgb(var(${name}))`, theme));
                expect(getContrastTextStyles(hex, theme)).toEqual(getContrastTextStyles(rgb, theme));
            }
        }
        expect(computed).not.toHaveBeenCalled();
        expect(getTextColorTone(null)).toBeNull();
        expect(getTextColorTone(parseColor('rgba(99,102,241,.2)'))).toBe('dark');
        // Indigo's raw RGB now follows its label, but image textures keep the old <60 rule.
        expect(getContrastTextStyles('#6366f1', 'dark', { isTextureMode: true }).textShadow)
            .toBe('0 1px 2px rgba(0,0,0,0.8)');
        const read = () => parseColor('#6366f1');
        expect(getContrastTextStyles('rgb(var(--c-status-danger))', 'dark', { read }).textShadow)
            .toBe('0 1px 2px rgba(0,0,0,0.8)');
    });
});

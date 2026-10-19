import { createColorReader, type ColorReader, type RgbaColor } from './color';

/** Source-over composition in sRGB, retaining alpha until an opaque backing is known. */
export function compositeColors(foreground: RgbaColor, background: RgbaColor): RgbaColor {
    const a = foreground.a + background.a * (1 - foreground.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const component = (key: 'r' | 'g' | 'b') =>
        (foreground[key] * foreground.a + background[key] * background.a * (1 - foreground.a)) / a;
    return { r: component('r'), g: component('g'), b: component('b'), a };
}

/** RGB luminance only; transparent paint must first be composited against its backing. */
export function relativeLuminance(color: RgbaColor): number {
    const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return linear(color.r) * 0.2126 + linear(color.g) * 0.7152 + linear(color.b) * 0.0722;
}

export function contrastOnBackground(foreground: RgbaColor, background: RgbaColor): number | null {
    if (background.a !== 1) return null;
    const paint = compositeColors(foreground, background);
    const first = relativeLuminance(paint);
    const second = relativeLuminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export type SolidTextChoice = 'dark' | 'light';
export const SOLID_TEXT_COLORS = {
    dark: 'rgb(var(--c-slate-900))', light: 'rgb(var(--c-slate-50))',
} as const;

interface SolidTextOptions {
    backdrop?: string;
    colors?: { dark: string; light: string };
    read?: ColorReader;
}

/** Choose between actual foreground candidates, independently of the global light/dark label. */
export function getSolidTextChoice(background: string, options: SolidTextOptions = {}): SolidTextChoice | null {
    const read = options.read || createColorReader();
    let paint = read(background);
    if (!paint) return null;
    if (paint.a < 1) {
        const backing = options.backdrop ? read(options.backdrop) : null;
        if (!backing || backing.a !== 1) return null;
        paint = compositeColors(paint, backing);
    }
    const colors = options.colors || { dark: 'black', light: 'white' };
    const dark = read(colors.dark);
    const light = read(colors.light);
    if (!dark || !light) return null;
    const darkRatio = contrastOnBackground(dark, paint)!;
    const lightRatio = contrastOnBackground(light, paint)!;
    return darkRatio >= lightRatio ? 'dark' : 'light';
}

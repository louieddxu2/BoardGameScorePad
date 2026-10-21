import { createColorReader, formatColor, type ColorReader, type RgbaColor } from './color';

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

/** Check both CSS paint and its composited, integer-channel bitmap result. */
export function contrastAfterRounding(foreground: RgbaColor, background: RgbaColor): number | null {
    const ratio = contrastOnBackground(foreground, background);
    if (ratio === null) return null;
    const round = (color: RgbaColor): RgbaColor => ({
        r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: color.a,
    });
    return Math.min(ratio, contrastOnBackground(round(compositeColors(foreground, background)), round(background))!);
}

/** Display-only ink: retain readable colors, otherwise shade the same hue toward
 * an opaque endpoint. Check CSS paint and rounded export colors, including backing.
 * Transparent ink and unresolved surfaces keep their original CSS behavior. */
export function getReadableLabelInk(ink: RgbaColor, background: RgbaColor): string | undefined {
    const ratio = contrastAfterRounding(ink, background);
    if (ink.a === 0 || ratio === null || ratio >= 4.5) return undefined;
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const endpoint = contrastOnBackground(black, background)! >= contrastOnBackground(white, background)!
        ? black : white;
    const shade = (amount: number): RgbaColor => ({
        r: Math.round(ink.r + (endpoint.r - ink.r) * amount),
        g: Math.round(ink.g + (endpoint.g - ink.g) * amount),
        b: Math.round(ink.b + (endpoint.b - ink.b) * amount),
        a: ink.a + (1 - ink.a) * amount,
    });
    let low = 0;
    let high = 1;
    // Bounded, pure color math; no measurements or additional render lifecycle.
    for (let step = 0; step < 12; step++) {
        const middle = (low + high) / 2;
        if (contrastAfterRounding(shade(middle), background)! >= 4.51) high = middle;
        else low = middle;
    }
    return formatColor(shade(high));
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

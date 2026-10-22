import type { RgbaColor } from './color';

// Midpoints between the existing 17-color palette's labeled Oklab L ranges:
// dark indigo / neutral violet, and neutral amber / light yellow.
// Keep these fixed; explicit COLOR_TONES labels remain authoritative.
const DARK_LIMIT = (0.5854043099280906 + 0.6056307524243788) / 2;
const LIGHT_LIMIT = (0.7685903543348416 + 0.8605594574290993) / 2;

/** Oklab L from sRGB; classification only, never a replacement foreground.
 * Reference: https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab */
export const getTextColorTone = (color: RgbaColor | null): 'dark' | 'neutral' | 'light' | null => {
    if (!color) return null;
    const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const r = linear(color.r);
    const g = linear(color.g);
    const b = linear(color.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const lightness = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    return lightness < DARK_LIMIT ? 'dark' : lightness > LIGHT_LIMIT ? 'light' : 'neutral';
};

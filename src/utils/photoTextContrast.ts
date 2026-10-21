import type { CSSProperties } from 'react';
import { formatColor, parseColor, readColor, type ColorReader } from './color';
import { compositeColors, contrastAfterRounding, getReadableLabelInk, relativeLuminance } from './colorContrast';

/** Blur-free outlines survive image export and protect every edge of a glyph. */
export const getPhotoTextOutline = (color: string, softShadow: string, width = 2): string => [
    `-${width}px -${width}px 0 ${color}`, `0 -${width}px 0 ${color}`, `${width}px -${width}px 0 ${color}`,
    `-${width}px 0 0 ${color}`, `${width}px 0 0 ${color}`,
    `-${width}px ${width}px 0 ${color}`, `0 ${width}px 0 ${color}`, `${width}px ${width}px 0 ${color}`,
    softShadow,
].join(', ');

/** Preserve the player's fill color, with a legible edge even on a similarly colored card. */
const getPhotoPlayerOutlineColor = (luminance: number): string => {
    const whiteContrast = 1.05 / (luminance + 0.05);
    const blackContrast = (luminance + 0.05) / 0.05;
    return whiteContrast > blackContrast ? '#ffffff' : '#000000';
};

export const getPhotoPlayerNameShadow = (color: string, background?: string, read: ColorReader = readColor): string => {
    const foreground = read(color);
    const backing = background ? read(background) : null;
    if (foreground && backing?.a === 1) {
        const contrast = contrastAfterRounding(foreground, backing)!;
        if (contrast >= 4.5) return 'none';
        const paint = compositeColors(foreground, backing);
        const outline = getPhotoPlayerOutlineColor(relativeLuminance(paint));
        const width = contrast >= 3 ? 0.5 : contrast >= 2 ? 0.85 : 1.25;
        return getPhotoTextOutline(outline, '0 1px 2px rgba(0,0,0,0.12)', width);
    }
    // Before sampling, or for unsupported CSS colors, retain the conservative outline.
    const outline = getPhotoPlayerOutlineColor(foreground ? relativeLuminance(foreground) : 0);
    return getPhotoTextOutline(outline, '0 2px 3px rgba(0,0,0,0.25)', 1.25);
};

// Relative luminance, not the black/white foreground crossover (~0.18).
// Below 0.35, retain the original ink; 0.35–0.60 is the middle-to-light transition.
const INK_BLEND_START = 0.35;
const LIGHT_SURFACE_START = 0.60;

/** Dark and middle photo plates retain identity colors and contrast protection.
 * Blend toward readable UI ink only as the plate becomes genuinely light, so
 * neighboring photo tones cannot abruptly turn a bright player color almost black. */
export const getPhotoPlayerNameStyles = (
    color: string, background: string, read: ColorReader = readColor,
): CSSProperties => {
    const foreground = read(color);
    const backing = read(background);
    let displayColor = color;
    if (foreground && backing?.a === 1) {
        const brightness = relativeLuminance(backing);
        if (brightness > INK_BLEND_START) {
            const adapted = getReadableLabelInk(foreground, backing);
            if (adapted) {
                const ink = parseColor(adapted)!;
                const progress = Math.min(1, (brightness - INK_BLEND_START) / (LIGHT_SURFACE_START - INK_BLEND_START));
                const amount = progress * progress * (3 - 2 * progress);
                displayColor = formatColor({
                    r: Math.round(foreground.r + (ink.r - foreground.r) * amount),
                    g: Math.round(foreground.g + (ink.g - foreground.g) * amount),
                    b: Math.round(foreground.b + (ink.b - foreground.b) * amount),
                    a: foreground.a + (ink.a - foreground.a) * amount,
                });
            }
            if (brightness >= LIGHT_SURFACE_START) {
                return {
                    color: displayColor,
                    textShadow: 'none', WebkitTextStroke: 0, filter: 'none',
                };
            }
        }
    }
    return {
        color: displayColor, textShadow: getPhotoPlayerNameShadow(displayColor, background, read),
        WebkitTextStroke: '', filter: '',
    };
};

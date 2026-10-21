import type { CSSProperties } from 'react';
import { readColor, type ColorReader } from './color';
import { compositeColors, contrastAfterRounding, relativeLuminance } from './colorContrast';
import { getContrastTextStyles } from './ui';
import { PHOTO_DARK_SURFACE_MAX_LUMINANCE } from './photoResultPalette';

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

/** Normal-weight, shadow-free names are the default for photo exports.
 * Only clearly dark backing retains the original bold/outline treatment.
 * Selected player colors may deepen, but never become pale through white mixing. */
export const getPhotoPlayerNameStyles = (
    color: string, background: string, read: ColorReader = readColor,
): CSSProperties => {
    const backing = read(background);
    if (backing?.a === 1 && relativeLuminance(backing) <= PHOTO_DARK_SURFACE_MAX_LUMINANCE) {
        return {
            color, fontWeight: 700, textShadow: getPhotoPlayerNameShadow(color, background, read),
            WebkitTextStroke: '', filter: '',
        };
    }
    // Use the scoreboard's light-label policy directly. Export only needs its ink;
    // do not copy UI color transitions into a bitmap captured immediately afterward.
    const lightStyles = getContrastTextStyles(color, 'light', { cleanOnLight: true, background, read });
    return {
        color: lightStyles.color ?? color,
        fontWeight: 400, textShadow: 'none', WebkitTextStroke: 0, filter: 'none',
    };
};

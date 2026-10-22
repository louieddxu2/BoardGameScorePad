import type { CSSProperties } from 'react';
import { readColor, type ColorReader } from './color';
import { relativeLuminance } from './colorContrast';
import { PHOTO_DARK_SURFACE_MAX_LUMINANCE } from './photoResultPalette';
import { getContrastTextStyles } from './ui';

/** Blur-free outlines survive image export and protect every edge of a glyph. */
export const getPhotoTextOutline = (color: string, softShadow: string, width = 2): string => [
    `-${width}px -${width}px 0 ${color}`, `0 -${width}px 0 ${color}`, `${width}px -${width}px 0 ${color}`,
    `-${width}px 0 0 ${color}`, `${width}px 0 0 ${color}`,
    `-${width}px ${width}px 0 ${color}`, `0 ${width}px 0 ${color}`, `${width}px ${width}px 0 ${color}`,
    softShadow,
].join(', ');

/** Keep selected ink and the UI's existing tone policy, without export transitions.
 * Only clearly dark plates retain heavier font weight. */
export const getPhotoPlayerNameStyles = (
    color: string, background: string, read: ColorReader = readColor,
): CSSProperties => {
    const backing = read(background);
    const isDark = backing?.a === 1 && relativeLuminance(backing) <= PHOTO_DARK_SURFACE_MAX_LUMINANCE;
    const { textShadow } = getContrastTextStyles(color, isDark ? 'dark' : 'light', { read });
    return {
        color,
        fontWeight: isDark ? 700 : 400, textShadow,
        WebkitTextStroke: isDark ? '' : 0, filter: isDark ? '' : 'none',
    };
};

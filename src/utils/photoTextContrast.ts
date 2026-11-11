import type { CSSProperties } from 'react';
import { parseColor, readColor, withColorOpacity, type ColorReader } from './color';
import { getPhotoNamePlateAppearance } from './photoNamePlate';
import {
    compositeColors, contrastAfterRounding, contrastOnBackground, getSolidTextChoice,
    relativeLuminance, SOLID_TEXT_COLORS,
} from './colorContrast';
import { PHOTO_RESULT_FALLBACK } from './photoResultPalette';
import { getQuickActionTextStyles, getQuickActionVisibleFill } from './quickActionColors';
import { getContrastTextStyles } from './ui';

/** Reuse the scoreboard's ink categories, normal light weight and palette edges.
 * Export pixels are 3x a typical 360px photo preview; scale shadows, not ink.
 * Photo-derived default names can still retain their original dark weight. */
export const getPhotoPlayerNameStyles = (
    color: string, background: string, read: ColorReader = readColor,
): CSSProperties => {
    const appearance = getPhotoNamePlateAppearance(background, read);
    const { transition: _transition, ...styles } = getContrastTextStyles(color, appearance, { read });
    return {
        ...styles, color,
        fontWeight: appearance === 'dark' ? 700 : 400,
        textShadow: styles.textShadow?.replace(/(-?[\d.]+)px/g, (_, value: string) => `${Number(value) * 3}px`),
        WebkitTextStroke: 0, filter: 'none',
    };
};

const COLUMN_OUTLINE_COLORS = { dark: PHOTO_RESULT_FALLBACK.background, light: PHOTO_RESULT_FALLBACK.text };
const COLUMN_NEAR_MATCH_CHANNEL_DELTA = 32;
const getColumnEdge = (color: string, width: number) => [
    `${width}px 0`, `-${width}px 0`, `0 ${width}px`, `0 -${width}px`,
].map(offset => `${offset} 0 ${color}`).join(', ');
const COLUMN_BLACK_EDGE = getColumnEdge('rgb(var(--c-black))', 1.5);

/** Use a dark edge only when pale column ink nearly disappears into its backing. */
export const getPhotoColumnNameStyles = (color: string, background: string, read: ColorReader = readColor): CSSProperties => {
    const styles = { color, fontWeight: 600, textShadow: 'none' };
    const ink = read(color);
    const backing = read(background);
    if (!ink || ink.a === 0 || backing?.a !== 1 || contrastOnBackground(ink, backing)! >= 4.5) return styles;

    const edge = getSolidTextChoice(background, { colors: COLUMN_OUTLINE_COLORS, read });
    if (edge === 'dark') {
        const visibleInk = compositeColors(ink, backing);
        const channelDelta = Math.max(
            Math.abs(visibleInk.r - backing.r), Math.abs(visibleInk.g - backing.g), Math.abs(visibleInk.b - backing.b),
        );
        return relativeLuminance(backing) >= 0.5 && channelDelta <= COLUMN_NEAR_MATCH_CHANNEL_DELTA
            ? { ...styles, textShadow: COLUMN_BLACK_EDGE }
            : styles;
    }

    const edgeColor = withColorOpacity(COLUMN_OUTLINE_COLORS.light, 0.72) ?? COLUMN_OUTLINE_COLORS.light;
    return { ...styles, textShadow: getColumnEdge(edgeColor, 0.75) };
};

const PHOTO_OPTION_CONTRAST = 4.6;

/** Shade the full badge when its white label needs more contrast. */
export const getPhotoOptionStyles = (background: string, backdrop: string, read: ColorReader = readColor) => {
    const { color } = getQuickActionTextStyles(background, backdrop, read);
    const styles = { color, textShadow: 'none', backgroundImage: 'none' };
    if (styles.color !== SOLID_TEXT_COLORS.light) return styles;

    const fill = getQuickActionVisibleFill(background, backdrop, read);
    if (fill?.a !== 1) return styles;
    const ink = read(styles.color) ?? parseColor(PHOTO_RESULT_FALLBACK.text)!;
    if (contrastAfterRounding(ink, fill)! >= PHOTO_OPTION_CONTRAST) return styles;

    const black = read('rgb(var(--c-black))') ?? parseColor('black')!;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 8; step++) {
        const opacity = (low + high) / 2;
        const shaded = compositeColors({ ...black, a: opacity }, fill);
        if (contrastAfterRounding(ink, shaded)! >= PHOTO_OPTION_CONTRAST) high = opacity;
        else low = opacity;
    }
    const shade = `rgb(var(--c-black) / ${high})`;
    return {
        ...styles,
        backgroundImage: `linear-gradient(${shade}, ${shade})`,
    };
};

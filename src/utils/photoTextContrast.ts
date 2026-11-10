import type { CSSProperties } from 'react';
import { parseColor, readColor, withColorOpacity, type ColorReader } from './color';
import { getPhotoNamePlateAppearance } from './photoNamePlate';
import { compositeColors, contrastAfterRounding, contrastOnBackground, getSolidTextChoice, getTextOutline, SOLID_TEXT_COLORS } from './colorContrast';
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

/** A column's ink stays intact when the sampled photo has a similar tone. */
export const getPhotoColumnNameStyles = (color: string, background: string, read: ColorReader = readColor): CSSProperties => {
    const styles = { ...getPhotoPlayerNameStyles(color, background, read), fontWeight: 600 };
    const ink = read(color);
    const backing = read(background);
    if (ink?.a === 0) return { ...styles, textShadow: 'none' };
    const contrast = ink && backing ? contrastOnBackground(ink, backing) : null;
    if (contrast === null || contrast >= 4.5) return styles;
    const edge = getSolidTextChoice(background, { colors: COLUMN_OUTLINE_COLORS, read }) ?? 'light';
    const edgeColor = withColorOpacity(COLUMN_OUTLINE_COLORS[edge], 0.72) ?? COLUMN_OUTLINE_COLORS[edge];
    return { ...styles, textShadow: getTextOutline(edgeColor, '0 1px 2px rgb(var(--c-black) / 0.35)', 0.75) };
};

const PHOTO_OPTION_COLOR_STRIP = 6;
const PHOTO_OPTION_CONTRAST = 4.6;

/** Give low-contrast white labels a quieter backing and keep a strip of the chosen fill visible. */
export const getPhotoOptionStyles = (background: string, backdrop: string, read: ColorReader = readColor) => {
    const styles = { ...getQuickActionTextStyles(background, backdrop, read), backgroundImage: 'none' };
    if (styles.color !== SOLID_TEXT_COLORS.light) return styles;

    const fill = getQuickActionVisibleFill(background, backdrop, read);
    if (fill?.a !== 1) return styles;
    const ink = read(styles.color) ?? parseColor(PHOTO_RESULT_FALLBACK.text)!;
    if (contrastAfterRounding(ink, fill)! >= PHOTO_OPTION_CONTRAST) return { ...styles, textShadow: 'none' };

    const black = read('rgb(var(--c-black))') ?? parseColor('black')!;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 8; step++) {
        const opacity = (low + high) / 2;
        const shaded = compositeColors({ ...black, a: opacity }, fill);
        if (contrastAfterRounding(ink, shaded)! >= PHOTO_OPTION_CONTRAST) high = opacity;
        else low = opacity;
    }
    return {
        ...styles,
        textShadow: 'none',
        backgroundImage: `linear-gradient(to right, transparent ${PHOTO_OPTION_COLOR_STRIP}px, rgb(var(--c-black) / ${high}) ${PHOTO_OPTION_COLOR_STRIP}px)`,
    };
};

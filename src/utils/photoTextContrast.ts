import type { CSSProperties } from 'react';
import { readColor, type ColorReader } from './color';
import { getPhotoNamePlateAppearance } from './photoNamePlate';
import { contrastOnBackground, getSolidTextChoice, getTextOutline } from './colorContrast';
import { PHOTO_RESULT_FALLBACK } from './photoResultPalette';
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
    return { ...styles, textShadow: getTextOutline(COLUMN_OUTLINE_COLORS[edge], '0 1px 2px rgb(var(--c-black) / 0.35)', 0.75) };
};

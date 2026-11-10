import type { CSSProperties } from 'react';
import { readColor, type ColorReader } from './color';
import { getPhotoNamePlateAppearance } from './photoNamePlate';
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

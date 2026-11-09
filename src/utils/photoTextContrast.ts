import type { CSSProperties } from 'react';
import { readColor, type ColorReader } from './color';
import { getPhotoNamePlateAppearance } from './photoNamePlate';
import { getContrastTextStyles } from './ui';
import { compositeColors, relativeLuminance, SOLID_TEXT_COLORS } from './colorContrast';

/** Blur-free outlines survive image export and protect every edge of a glyph. */
export const getPhotoTextOutline = (color: string, softShadow: string, width = 2): string => [
    `-${width}px -${width}px 0 ${color}`, `0 -${width}px 0 ${color}`, `${width}px -${width}px 0 ${color}`,
    `-${width}px 0 0 ${color}`, `${width}px 0 0 ${color}`,
    `-${width}px ${width}px 0 ${color}`, `0 ${width}px 0 ${color}`, `${width}px ${width}px 0 ${color}`,
    softShadow,
].join(', ');

const LABEL_LIGHT_BACKGROUND = 0.5;
const LABEL_WHITE_INK_MAX_LUMINANCE = 0.17;
const LABEL_WHITE_TEXT_OUTLINE = getPhotoTextOutline('rgba(15,23,42,0.9)', '0 1px 2px rgba(15,23,42,0.35)', 1);

/** Photo badges use white ink on midtones, with a fine edge where white alone is too faint. */
export const getPhotoLabelTextStyles = (
    background: string, backdrop: string, read: ColorReader = readColor,
): Required<Pick<CSSProperties, 'color' | 'textShadow'>> => {
    const paint = read(background);
    const surface = paint && paint.a < 1 ? read(backdrop) : null;
    const luminance = paint ? relativeLuminance(surface ? compositeColors(paint, surface) : paint) : 0;
    const useDarkInk = luminance >= LABEL_LIGHT_BACKGROUND;
    return {
        color: useDarkInk ? SOLID_TEXT_COLORS.dark : SOLID_TEXT_COLORS.light,
        textShadow: !useDarkInk && luminance > LABEL_WHITE_INK_MAX_LUMINANCE ? LABEL_WHITE_TEXT_OUTLINE : 'none',
    };
};

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

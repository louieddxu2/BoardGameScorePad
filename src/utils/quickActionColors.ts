import { readColor, type ColorReader } from './color';
import { compositeColors, getTextOutline, relativeLuminance, SOLID_TEXT_COLORS } from './colorContrast';

const LIGHT_BACKGROUND = 0.5;
const WHITE_INK_MAX_LUMINANCE = 0.17;
const WHITE_TEXT_OUTLINE = getTextOutline('rgba(15,23,42,0.9)', '0 1px 2px rgba(15,23,42,0.35)', 1);

export const getQuickActionBackground = (actionColor?: string, columnColor?: string): string =>
    actionColor || columnColor || 'rgb(var(--c-white))';

/** Option buttons and photo badges use the same ink on a given visible fill. */
export const getQuickActionTextStyles = (background: string, backdrop: string, read: ColorReader = readColor) => {
    const paint = read(background);
    const surface = paint && paint.a < 1 ? read(backdrop) : null;
    const luminance = paint ? relativeLuminance(surface ? compositeColors(paint, surface) : paint) : 0;
    const useDarkInk = luminance >= LIGHT_BACKGROUND;
    return {
        color: useDarkInk ? SOLID_TEXT_COLORS.dark : SOLID_TEXT_COLORS.light,
        textShadow: !useDarkInk && luminance > WHITE_INK_MAX_LUMINANCE ? WHITE_TEXT_OUTLINE : 'none',
    };
};

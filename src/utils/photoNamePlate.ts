import { formatColor, readColor, type ColorReader, type RgbaColor } from './color';
import { compositeColors, relativeLuminance } from './colorContrast';
import { PHOTO_DARK_SURFACE_MAX_LUMINANCE } from './photoResultPalette';

// Match each scoreboard's reading surface and player-color wash.
// Fixed export paint must not inherit the current app theme or a photo's hue.
const NAME_SURFACES = {
    light: { base: { r: 251, g: 250, b: 247, a: 1 }, wash: 0.045 },
    dark: { base: { r: 15, g: 23, b: 42, a: 1 }, wash: 0.12549 },
} satisfies Record<string, { base: RgbaColor; wash: number }>;
type NamePlateAppearance = keyof typeof NAME_SURFACES;

/** Reuse the existing clearly-dark rule; the photo only selects a fixed style. */
export const getPhotoNamePlateAppearance = (
    background: string, read: ColorReader = readColor,
): NamePlateAppearance => {
    const backing = read(background);
    return backing?.a === 1 && relativeLuminance(backing) <= PHOTO_DARK_SURFACE_MAX_LUMINANCE
        ? 'dark' : 'light';
};

/** Only the backing is tinted; selected ink retains its RGB/alpha. */
export const getPhotoNamePlateBackground = (
    color: string, read: ColorReader = readColor,
    appearance: NamePlateAppearance = 'light',
): string => {
    const { base, wash } = NAME_SURFACES[appearance];
    const ink = read(color);
    const backing = ink
        ? compositeColors({ ...ink, a: ink.a * wash }, base)
        : base;
    return formatColor({
        r: Math.round(backing.r), g: Math.round(backing.g), b: Math.round(backing.b), a: 1,
    });
};

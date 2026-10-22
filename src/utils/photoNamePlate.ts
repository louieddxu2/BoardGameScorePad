import { formatColor, readColor, type ColorReader, type RgbaColor } from './color';
import { compositeColors } from './colorContrast';

// Match the light scoreboard's reading surface and thin player-color wash.
// Fixed export paint must not inherit the current app theme or a photo's hue.
const LIGHT_GRID_BASE: RgbaColor = { r: 251, g: 250, b: 247, a: 1 };
const PLAYER_TINT_OPACITY = 0.045;

/** A quiet near-white name header. Only its backing is tinted; selected ink
 * retains its RGB/alpha and uses the scoreboard's light-theme edge protection. */
export const getPhotoNamePlateBackground = (
    color: string, read: ColorReader = readColor,
): string => {
    const ink = read(color);
    const backing = ink
        ? compositeColors({ ...ink, a: ink.a * PLAYER_TINT_OPACITY }, LIGHT_GRID_BASE)
        : LIGHT_GRID_BASE;
    return formatColor({
        r: Math.round(backing.r), g: Math.round(backing.g), b: Math.round(backing.b), a: 1,
    });
};

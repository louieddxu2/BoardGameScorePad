import { formatColor, parseColor, readColor, type ColorReader, type RgbaColor } from './color';
import { compositeColors } from './colorContrast';
import { PHOTO_RESULT_FALLBACK } from './photoResultPalette';
import { getOklabLightness } from './textColorTone';

const BLACK: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };
const FALLBACK = parseColor(PHOTO_RESULT_FALLBACK.identity)!;
const round = (color: RgbaColor): RgbaColor => ({
    r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: color.a,
});

/** Calibrated from the 17 labeled colors on the existing tinted name headers:
 * dark: indigo/violet gap midpoint; light: yellow/amber gap midpoint.
 * Intermediate photo surfaces interpolate; this is not a WCAG contrast ratio. */
export const getPhotoNameRequiredGap = (backgroundLightness: number): number => {
    const position = Math.max(0, Math.min(1, (backgroundLightness - 0.26) / 0.72));
    return 0.3343 + (0.1614 - 0.3343) * position;
};

/** Adjust only the opaque name plate. Every preset player color has a passing
 * black or white endpoint. Search is bounded, checks final 8-bit paint, and
 * never samples an image or changes the selected foreground RGB/alpha. */
export const getPhotoNamePlateBackground = (
    color: string, background: string, read: ColorReader = readColor,
): string => {
    const ink = read(color);
    if (!ink || ink.a === 0) return background;
    const source = read(background);
    const backing = source?.a === 1 ? source : FALLBACK;
    const base = round(backing);
    const inkLightness = ink.a === 1 ? getOklabLightness(ink) : null;
    const roundedInkLightness = ink.a === 1 ? getOklabLightness(round(ink)) : null;
    const margin = (plate: RgbaColor): number => {
        const lightness = getOklabLightness(plate);
        const paint = ink.a === 1 ? ink : compositeColors(ink, plate);
        const difference = Math.min(
            Math.abs((inkLightness ?? getOklabLightness(paint)) - lightness),
            Math.abs((roundedInkLightness ?? getOklabLightness(round(paint))) - lightness),
        );
        return difference - getPhotoNameRequiredGap(lightness);
    };
    if (source?.a === 1 && margin(backing) >= 0 && margin(base) >= 0) return background;

    const baseLightness = getOklabLightness(base);
    const find = (endpoint: RgbaColor): RgbaColor | null => {
        if (margin(endpoint) < 0) return null;
        let low = 0;
        let high = 1;
        let passing = endpoint;
        for (let step = 0; step < 12; step++) {
            const amount = (low + high) / 2;
            const candidate = round({
                r: base.r + (endpoint.r - base.r) * amount,
                g: base.g + (endpoint.g - base.g) * amount,
                b: base.b + (endpoint.b - base.b) * amount, a: 1,
            });
            if (margin(candidate) >= 0) { high = amount; passing = candidate; }
            else low = amount;
        }
        return passing;
    };
    const dark = find(BLACK);
    const light = find(WHITE);
    if (dark && light) {
        return formatColor(Math.abs(getOklabLightness(dark) - baseLightness)
            <= Math.abs(getOklabLightness(light) - baseLightness) ? dark : light);
    }
    // Imported near-transparent ink may have no passing endpoint; retain its
    // alpha and use the best available backing rather than inventing a new ink.
    return formatColor(dark ?? light ?? (margin(BLACK) >= margin(WHITE) ? BLACK : WHITE));
};

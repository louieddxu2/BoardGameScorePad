import { formatColor, parseColor, type RgbaColor } from './color';
import { contrastOnBackground } from './colorContrast';

interface PhotoResultPalette {
    background: string;
    card: string;
    identity: string;
    border: string;
    text: string;
    muted: string;
    winner: string;
}

export const PHOTO_RESULT_FALLBACK: Readonly<PhotoResultPalette> = {
    background: '#1e293b', card: '#334155', identity: '#293649', border: '#64748b',
    text: '#f8fafc', muted: '#cbd5e1', winner: '#fbbf24',
};

const DARK_INK = parseColor('#0f172a')!;
const LIGHT_INK = parseColor('#f8fafc')!;
const WHITE = parseColor('#ffffff')!;
const BLACK = parseColor('#000000')!;
// Reserve heavier photo-name styling for clearly dark plates (about #595959).
export const PHOTO_DARK_SURFACE_MAX_LUMINANCE = 0.10;
// Leave a little headroom for image-export channel rounding.
const TEXT_CONTRAST = 4.6;
const mix = (from: RgbaColor, to: RgbaColor, amount: number): RgbaColor => ({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
    a: 1,
});
const minimumContrast = (ink: RgbaColor, surfaces: RgbaColor[]) =>
    Math.min(...surfaces.map(surface => contrastOnBackground(ink, surface)!));

/** Keep a decorative seed as close as possible while meeting every backing's contrast. */
const readableTint = (seed: RgbaColor, ink: RgbaColor, surfaces: RgbaColor[], target: number): RgbaColor => {
    if (minimumContrast(seed, surfaces) >= target) return seed;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 8; step++) {
        const amount = (low + high) / 2;
        if (minimumContrast(mix(seed, ink, amount), surfaces) >= target) high = amount;
        else low = amount;
    }
    return mix(seed, ink, high);
};

/** Pick a common color from a tiny sample, ignoring transparent/near-gray pixels. */
export const getPhotoResultPalette = (pixels: Uint8ClampedArray): PhotoResultPalette => {
    const buckets = new Map<number, { red: number; green: number; blue: number; count: number }>();
    let dominant: { red: number; green: number; blue: number; count: number } | undefined;
    let brightness = 0;
    let opaqueCount = 0;
    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const red = pixels[i];
        const green = pixels[i + 1];
        const blue = pixels[i + 2];
        // Include neutral pixels in the light/dark decision, but not in the hue histogram.
        brightness += red * 0.299 + green * 0.587 + blue * 0.114;
        totalRed += red;
        totalGreen += green;
        totalBlue += blue;
        opaqueCount++;
        if (Math.max(red, green, blue) - Math.min(red, green, blue) < 20) continue;
        // Four bins per channel bound the histogram to 64 entries.
        const key = (red >> 6) * 16 + (green >> 6) * 4 + (blue >> 6);
        const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0 };
        bucket.red += red;
        bucket.green += green;
        bucket.blue += blue;
        bucket.count++;
        buckets.set(key, bucket);
        if (!dominant || bucket.count > dominant.count) dominant = bucket;
    }
    if (opaqueCount === 0) return { ...PHOTO_RESULT_FALLBACK };

    // A continuous curve gently deepens midtones so the panel does not look washed out.
    const level = 24 + Math.pow(brightness / opaqueCount / 255, 1.5) * 216;
    const red = dominant ? dominant.red / dominant.count : totalRed / opaqueCount;
    const green = dominant ? dominant.green / dominant.count : totalGreen / opaqueCount;
    const blue = dominant ? dominant.blue / dominant.count : totalBlue / opaqueCount;
    const dominantBrightness = red * 0.299 + green * 0.587 + blue * 0.114;
    // A tiny colored object in a neutral photo must not tint the whole score panel.
    const strength = dominant ? 0.38 * Math.min(1, dominant.count / opaqueCount * 5) : 0.38;
    const channel = (value: number) => Math.max(0, Math.min(255, level + (value - dominantBrightness) * strength));
    const background = { r: channel(red), g: channel(green), b: channel(blue), a: 1 };
    const card = mix(background, WHITE, 0.07);
    const identity = mix(card, BLACK, 0.035);
    let surfaces = [background, card, identity];
    const ink = minimumContrast(DARK_INK, surfaces) >= minimumContrast(LIGHT_INK, surfaces) ? DARK_INK : LIGHT_INK;
    // Only neutral scores/captions constrain the palette. Chosen player colors
    // retain their fill and use edge protection instead of forcing lighter panels.
    // Binary search is bounded and runs on three colors, not on additional image pixels.
    if (minimumContrast(ink, surfaces) < TEXT_CONTRAST) {
        const anchor = ink === DARK_INK ? WHITE : BLACK;
        let low = 0;
        let high = 1;
        for (let step = 0; step < 8; step++) {
            const amount = (low + high) / 2;
            if (minimumContrast(ink, surfaces.map(surface => mix(surface, anchor, amount))) >= TEXT_CONTRAST) high = amount;
            else low = amount;
        }
        surfaces = surfaces.map(surface => mix(surface, anchor, high));
    }
    const [base, tile, name] = surfaces;
    const gold = parseColor(ink === LIGHT_INK ? '#fbbf24' : '#854d0e')!;
    return {
        background: formatColor(base), card: formatColor(tile), identity: formatColor(name),
        border: formatColor(mix(tile, ink, 0.14)), text: formatColor(ink),
        muted: formatColor(readableTint(mix(ink, base, 0.24), ink, surfaces, TEXT_CONTRAST)),
        winner: formatColor(readableTint(gold, ink, surfaces, 3.1)),
    };
};

interface PhotoResultPalette {
    background: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    winner: string;
}

export const PHOTO_RESULT_FALLBACK: Readonly<PhotoResultPalette> = {
    background: '#1e293b', card: '#334155', border: '#64748b',
    text: '#f8fafc', muted: '#cbd5e1', winner: '#fbbf24',
};

const LIGHT_NEUTRAL: Readonly<PhotoResultPalette> = {
    background: '#f1f5f9', card: '#ffffff', border: '#94a3b8',
    text: '#0f172a', muted: '#475569', winner: '#854d0e',
};

/** Pick a common color from a tiny sample, ignoring transparent/near-gray pixels. */
export const getPhotoResultPalette = (pixels: Uint8ClampedArray): PhotoResultPalette => {
    const buckets = new Map<number, { red: number; green: number; blue: number; count: number }>();
    let dominant: { red: number; green: number; blue: number; count: number } | undefined;
    let brightness = 0;
    let opaqueCount = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const [red, green, blue] = [pixels[i], pixels[i + 1], pixels[i + 2]];
        // Include neutral pixels in the light/dark decision, but not in the hue histogram.
        brightness += red * 0.299 + green * 0.587 + blue * 0.114;
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
    const isLight = opaqueCount > 0 && brightness / opaqueCount >= 160;
    const neutral = isLight ? LIGHT_NEUTRAL : PHOTO_RESULT_FALLBACK;
    if (!dominant) return { ...neutral };

    const red = dominant.red / dominant.count;
    const green = dominant.green / dominant.count;
    const blue = dominant.blue / dominant.count;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    // Opposite muted colors in the same bin can average back to gray.
    if (delta < 20) return { ...neutral };
    const sector = max === red ? (green - blue) / delta
        : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    const hue = Math.round((sector * 60 + 360) % 360);
    const saturation = delta / (255 - Math.abs(max + min - 255));
    const mutedSaturation = Math.min(44, Math.max(24, saturation * 65));
    const tone = (scale: number, lightness: number) => `hsl(${hue}, ${Math.round(mutedSaturation * scale)}%, ${lightness}%)`;
    // Opaque surfaces keep the sampled hue visible instead of diluting it over app gray.
    // The photo controls both surfaces and text, independently of the app theme.
    return isLight
        ? { ...neutral, background: tone(1, 92), card: tone(0.85, 96), border: tone(1, 64) }
        : { ...neutral, background: tone(1, 22), card: tone(0.85, 30), border: tone(1, 52) };
};

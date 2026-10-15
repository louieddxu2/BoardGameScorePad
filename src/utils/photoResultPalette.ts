interface PhotoResultPalette {
    background: string;
    card: string;
    border: string;
}

export const PHOTO_RESULT_FALLBACK: Readonly<PhotoResultPalette> = {
    background: 'rgb(var(--c-app-bg))',
    card: 'rgb(var(--c-surface-bg))',
    border: 'rgb(var(--c-surface-border))',
};

/** Pick a common color from a tiny sample, ignoring transparent/near-gray pixels. */
export const getPhotoResultPalette = (pixels: Uint8ClampedArray, theme: 'dark' | 'light' = 'dark'): PhotoResultPalette => {
    const buckets = new Map<number, { red: number; green: number; blue: number; count: number }>();
    let dominant: { red: number; green: number; blue: number; count: number } | undefined;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const [red, green, blue] = [pixels[i], pixels[i + 1], pixels[i + 2]];
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
    if (!dominant) return { ...PHOTO_RESULT_FALLBACK };

    const red = dominant.red / dominant.count;
    const green = dominant.green / dominant.count;
    const blue = dominant.blue / dominant.count;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    // Opposite muted colors in the same bin can average back to gray.
    if (delta < 20) return { ...PHOTO_RESULT_FALLBACK };
    const sector = max === red ? (green - blue) / delta
        : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    const hue = Math.round((sector * 60 + 360) % 360);
    const saturation = delta / (255 - Math.abs(max + min - 255));
    const mutedSaturation = Math.min(44, Math.max(24, saturation * 65));
    const tone = (scale: number, lightness: number) => `hsl(${hue}, ${Math.round(mutedSaturation * scale)}%, ${lightness}%)`;
    // Opaque surfaces keep the sampled hue visible instead of diluting it over app gray.
    // Fixed lightness bounds preserve the existing theme's neutral text contrast.
    return theme === 'light'
        ? { background: tone(1, 92), card: tone(0.85, 96), border: tone(1, 64) }
        : { background: tone(1, 22), card: tone(0.85, 30), border: tone(1, 52) };
};

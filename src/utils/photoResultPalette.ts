interface PhotoResultPalette {
    tint: string;
    border: string;
}

export const PHOTO_RESULT_FALLBACK: Readonly<PhotoResultPalette> = {
    tint: 'transparent',
    border: 'rgb(var(--c-surface-border))',
};

/** Pick a common color from a tiny sample, ignoring transparent/near-gray pixels. */
export const getPhotoResultPalette = (pixels: Uint8ClampedArray): PhotoResultPalette => {
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
    const brightness = red * 0.299 + green * 0.587 + blue * 0.114;
    // Keep the hue, but constrain saturation/brightness so neither theme is overwhelmed.
    const tone = [red, green, blue].map(channel => Math.round(148 + (channel - brightness) * 0.25)).join(',');
    return { tint: `rgba(${tone},0.12)`, border: `rgba(${tone},0.45)` };
};

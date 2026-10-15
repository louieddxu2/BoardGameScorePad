interface TitleAppearance {
    color: string;
    shadow: string;
    background: string;
}

const WHITE_SHADOW = '0 1px 3px rgba(0,0,0,0.45)';
const DARK_SHADOW = '0 1px 2px rgba(255,255,255,0.5)';
const localScrim = (light: boolean) => `radial-gradient(ellipse at 30% 35%, ${
    light ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.5)'
}, transparent 80%)`;

export const PHOTO_TITLE_FALLBACK: Readonly<TitleAppearance> = {
    color: '#ffffff', shadow: WHITE_SHADOW, background: localScrim(false),
};

/** Count usable light/dark pixels, not just their average: a checkerboard needs a scrim. */
export const getPhotoTitleAppearance = (pixels: Uint8ClampedArray): TitleAppearance => {
    let dark = 0;
    let light = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const brightness = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
        if (brightness < 145) dark++;
        if (brightness > 175) light++;
        count++;
    }
    if (count === 0) return { ...PHOTO_TITLE_FALLBACK };
    const useDarkText = light > dark;
    const consistentBackground = Math.max(light, dark) / count >= 0.85;
    return {
        color: useDarkText ? '#111827' : '#ffffff',
        shadow: useDarkText ? DARK_SHADOW : WHITE_SHADOW,
        background: consistentBackground ? 'none' : localScrim(useDarkText),
    };
};

const waitForPhoto = (image: HTMLImageElement, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted) return Promise.resolve(false);
    if (image.complete) return Promise.resolve(image.naturalWidth > 0);
    return new Promise(resolve => {
        const finish = (loaded: boolean) => {
            image.removeEventListener('load', onLoad);
            image.removeEventListener('error', onError);
            signal.removeEventListener('abort', onError);
            resolve(loaded);
        };
        const onLoad = () => finish(true);
        const onError = () => finish(false);
        image.addEventListener('load', onLoad, { once: true });
        image.addEventListener('error', onError, { once: true });
        signal.addEventListener('abort', onError, { once: true });
    });
};

/** Runs only before export. One 48x24 sample of the title area, no full-resolution pixel scan. */
export const prepareScorePhotoTitle = async (root: HTMLElement, signal: AbortSignal): Promise<void> => {
    const image = root.querySelector<HTMLImageElement>('[data-score-photo-source]');
    const title = root.querySelector<HTMLElement>('[data-score-photo-title]');
    if (!image || !title || !await waitForPhoto(image, signal) || signal.aborted) return;

    let appearance = PHOTO_TITLE_FALLBACK;
    try {
        const imageRect = image.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        if (imageRect.width > 0 && imageRect.height > 0 && titleRect.width > 0 && titleRect.height > 0) {
            const scaleX = image.naturalWidth / imageRect.width;
            const scaleY = image.naturalHeight / imageRect.height;
            const x = Math.max(0, titleRect.left - imageRect.left) * scaleX;
            const y = Math.max(0, titleRect.top - imageRect.top) * scaleY;
            const width = Math.min(titleRect.width * scaleX, image.naturalWidth - x);
            const height = Math.min(titleRect.height * scaleY, image.naturalHeight - y);
            if (width > 0 && height > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 48;
                canvas.height = 24;
                const context = canvas.getContext('2d');
                if (context) {
                    context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
                    appearance = getPhotoTitleAppearance(context.getImageData(0, 0, canvas.width, canvas.height).data);
                }
            }
        }
    } catch {
        // Restricted canvases/unavailable pixel access must not prevent sharing.
    }
    if (signal.aborted) return;
    root.style.setProperty('--photo-title-color', appearance.color);
    root.style.setProperty('--photo-title-shadow', appearance.shadow);
    root.style.setProperty('--photo-title-background', appearance.background);
};

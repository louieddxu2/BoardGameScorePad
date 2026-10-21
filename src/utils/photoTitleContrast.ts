import { getPhotoResultPalette, PHOTO_RESULT_FALLBACK } from './photoResultPalette';
import { getPhotoPlayerNameStyles, getPhotoTextOutline } from './photoTextContrast';
import { createColorReader } from './color';

interface TitleAppearance {
    color: string;
    shadow: string;
    background: string;
}

const WHITE_SHADOW = getPhotoTextOutline('rgba(15,23,42,0.8)', '0 2px 4px rgba(0,0,0,0.3)');
const DARK_SHADOW = getPhotoTextOutline('rgba(248,250,252,0.95)', '0 1px 3px rgba(255,255,255,0.5)');
const RESULT_SAMPLE_RATIO = 0.3;
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

/** Runs only before export: two 48x24 samples on one canvas, never a full-resolution pixel scan. */
export const prepareScorePhotoTitle = async (root: HTMLElement, signal: AbortSignal): Promise<void> => {
    const image = root.querySelector<HTMLImageElement>('[data-score-photo-source]');
    const title = root.querySelector<HTMLElement>('[data-score-photo-title]');
    if (!image || !title || !await waitForPhoto(image, signal) || signal.aborted) return;

    let appearance = PHOTO_TITLE_FALLBACK;
    let palette = PHOTO_RESULT_FALLBACK;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 24;
        const context = image.naturalWidth > 0 && image.naturalHeight > 0 ? canvas.getContext('2d') : null;
        if (context) {
            // Match the photo edge adjacent to the results, not colors higher in the scene.
            const sampleHeight = Math.max(1, Math.round(image.naturalHeight * RESULT_SAMPLE_RATIO));
            context.drawImage(image, 0, image.naturalHeight - sampleHeight, image.naturalWidth, sampleHeight,
                0, 0, canvas.width, canvas.height);
            palette = getPhotoResultPalette(context.getImageData(0, 0, canvas.width, canvas.height).data);
        }
        const imageRect = image.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        if (imageRect.width > 0 && imageRect.height > 0 && titleRect.width > 0 && titleRect.height > 0) {
            const scaleX = image.naturalWidth / imageRect.width;
            const scaleY = image.naturalHeight / imageRect.height;
            const x = Math.max(0, titleRect.left - imageRect.left) * scaleX;
            const y = Math.max(0, titleRect.top - imageRect.top) * scaleY;
            const width = Math.min(titleRect.width * scaleX, image.naturalWidth - x);
            const height = Math.min(titleRect.height * scaleY, image.naturalHeight - y);
            if (width > 0 && height > 0 && context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
                appearance = getPhotoTitleAppearance(context.getImageData(0, 0, canvas.width, canvas.height).data);
            }
        }
    } catch {
        // Restricted canvases/unavailable pixel access must not prevent sharing.
    }
    if (signal.aborted) return;
    root.style.setProperty('--photo-title-color', appearance.color);
    root.style.setProperty('--photo-title-shadow', appearance.shadow);
    root.style.setProperty('--photo-title-background', appearance.background);
    root.style.setProperty('--photo-result-background', palette.background);
    root.style.setProperty('--photo-result-card', palette.card);
    root.style.setProperty('--photo-result-identity', palette.identity);
    root.style.setProperty('--photo-result-border', palette.border);
    root.style.setProperty('--photo-result-text', palette.text);
    root.style.setProperty('--photo-result-muted', palette.muted);
    root.style.setProperty('--photo-result-winner', palette.winner);
    // Sampling already knows the actual backing: refine each name once, before capture.
    const read = createColorReader();
    for (const name of root.querySelectorAll<HTMLElement>('[data-score-photo-name]')) {
        if (name.dataset.scorePhotoName === 'default') {
            name.style.fontWeight = String(getPhotoPlayerNameStyles(palette.text, palette.identity, read).fontWeight);
            name.style.textShadow = 'none';
            name.style.filter = 'none';
            name.style.setProperty('-webkit-text-stroke', '0');
            continue;
        }
        // Keep the original selected color on this export node, not in saved data.
        // Repeated captures must not shade an already adapted color or retain it on a dark photo.
        const color = name.dataset.scorePhotoColor ??= name.style.color;
        const { WebkitTextStroke, ...styles } = getPhotoPlayerNameStyles(color, palette.identity, read);
        Object.assign(name.style, styles);
        name.style.setProperty('-webkit-text-stroke', String(WebkitTextStroke ?? ''));
    }
};

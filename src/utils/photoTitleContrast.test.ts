import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPhotoTitleAppearance, PHOTO_TITLE_FALLBACK, prepareScorePhotoTitle } from './photoTitleContrast';
import { getPhotoResultPalette, PHOTO_RESULT_FALLBACK } from './photoResultPalette';
import { parseColor } from './color';
import { getContrastTextStyles } from './ui';

const pixels = (...brightness: number[]) => new Uint8ClampedArray(
    brightness.flatMap(value => [value, value, value, 255]),
);

afterEach(() => vi.restoreAllMocks());

describe('photo title contrast', () => {
    it.each([
        { background: 'dark', data: pixels(15, 30, 45), color: '#ffffff', needsScrim: false },
        { background: 'bright', data: pixels(230, 240, 255), color: '#111827', needsScrim: false },
        { background: 'mixed black and white', data: pixels(0, 255, 0, 255), color: '#ffffff', needsScrim: true },
    ])('adapts to a $background title area', ({ data, color, needsScrim }) => {
        const appearance = getPhotoTitleAppearance(data);
        expect(appearance.color).toBe(color);
        expect(appearance.background !== 'none').toBe(needsScrim);
        const outlineColor = color === '#111827' ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.8)';
        for (const offset of ['-2px -2px', '0 -2px', '2px -2px', '-2px 0', '2px 0', '-2px 2px', '0 2px', '2px 2px']) {
            expect(appearance.shadow).toContain(`${offset} 0 ${outlineColor}`);
        }
    });

    it('keeps a readable fallback when there are no opaque pixels', () => {
        expect(getPhotoTitleAppearance(new Uint8ClampedArray([255, 255, 255, 0])))
            .toEqual(PHOTO_TITLE_FALLBACK);
    });

    const setupPhoto = () => {
        const root = document.createElement('div');
        const image = document.createElement('img');
        image.dataset.scorePhotoSource = 'true';
        const title = document.createElement('h2');
        title.dataset.scorePhotoTitle = 'true';
        root.append(image, title);
        Object.defineProperties(image, {
            complete: { value: true }, naturalWidth: { value: 2160 }, naturalHeight: { value: 1440 },
        });
        vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
            left: -9999, top: 0, width: 1080, height: 720,
        } as DOMRect);
        vi.spyOn(title, 'getBoundingClientRect').mockReturnValue({
            left: -9967, top: 32, width: 400, height: 60,
        } as DOMRect);
        const context = { drawImage: vi.fn(), clearRect: vi.fn(), getImageData: vi.fn(() => ({ data: pixels(255, 255) })) };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
        return { root, image, context };
    };

    it('takes only the bottom 30 percent for result colors and independently samples the title rectangle', async () => {
        const { root, image, context } = setupPhoto();
        const photoPixels = new Uint8ClampedArray([200, 40, 20, 255]);
        context.getImageData.mockReturnValueOnce({ data: photoPixels });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(context.drawImage).toHaveBeenCalledTimes(2);
        expect(context.drawImage).toHaveBeenNthCalledWith(1, image, 0, 1008, 2160, 432, 0, 0, 48, 24);
        expect(context.drawImage).toHaveBeenNthCalledWith(2, image, 64, 64, 800, 120, 0, 0, 48, 24);
        expect(context.clearRect).toHaveBeenCalledExactlyOnceWith(0, 0, 48, 24);
        expect(context.getImageData).toHaveBeenCalledTimes(2);
        expect(root.style.getPropertyValue('--photo-result-background')).toBe(getPhotoResultPalette(photoPixels).background);
        expect(root.style.getPropertyValue('--photo-result-card')).toBe(getPhotoResultPalette(photoPixels).card);
        expect(root.style.getPropertyValue('--photo-result-identity')).toBe(getPhotoResultPalette(photoPixels).identity);
        expect(root.style.getPropertyValue('--photo-result-border')).toBe(getPhotoResultPalette(photoPixels).border);
        expect(root.style.getPropertyValue('--photo-title-color')).toBe('#111827');
        expect(root.style.getPropertyValue('--photo-title-background')).toBe('none');
    });

    it('keeps a neutral bottom edge neutral rather than looking elsewhere for a photo color', async () => {
        const { root, context } = setupPhoto();
        context.getImageData.mockReturnValueOnce({ data: pixels(80, 90) })
            .mockReturnValueOnce({ data: new Uint8ClampedArray([200, 40, 20, 255]) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        const expected = getPhotoResultPalette(pixels(80, 90));
        expect(root.style.getPropertyValue('--photo-result-background')).toBe(expected.background);
        expect(root.style.getPropertyValue('--photo-result-card')).toBe(expected.card);
        expect(context.drawImage).toHaveBeenCalledTimes(2);
        expect(context.getImageData).toHaveBeenCalledTimes(2);
    });

    it('refreshes each name against the sampled backing when photos change, without additional sampling', async () => {
        const { root, context } = setupPhoto();
        const name = document.createElement('span');
        name.dataset.scorePhotoName = 'custom';
        name.style.color = '#111111';
        name.textContent = 'Player';
        const defaultName = document.createElement('span');
        defaultName.dataset.scorePhotoName = 'default';
        defaultName.style.color = 'var(--photo-result-text, #f8fafc)';
        const yellowName = document.createElement('span');
        yellowName.dataset.scorePhotoName = 'custom';
        yellowName.dataset.scorePhotoColor = '#facc15';
        yellowName.style.color = '#facc15';
        const redName = document.createElement('span');
        redName.dataset.scorePhotoName = 'custom';
        redName.dataset.scorePhotoColor = '#ef4444';
        redName.style.color = '#ef4444';
        const blueName = document.createElement('span');
        blueName.dataset.scorePhotoName = 'custom';
        blueName.dataset.scorePhotoColor = '#3b82f6';
        blueName.style.color = '#3b82f6';
        root.append(name, defaultName, yellowName, redName, blueName);
        context.getImageData.mockReturnValue({ data: pixels(240) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(name.style.textShadow).toBe('0 0.5px 1px rgba(0,0,0,0.05)');
        expect(defaultName.style.textShadow).toBe('none');
        expect(name.style.fontWeight).toBe('400');
        expect(defaultName.style.fontWeight).toBe('400');
        const lightInk = yellowName.style.color;
        expect(lightInk).toBe('rgb(250, 204, 21)');
        expect(yellowName.style.textShadow).not.toBe('none');

        context.getImageData.mockReturnValue({ data: pixels(160) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(yellowName.style.fontWeight).toBe('400');
        expect(defaultName.style.fontWeight).toBe('400');
        expect(yellowName.style.color).toBe(lightInk);
        expect(yellowName.style.filter).toBe('none');

        context.getImageData.mockReturnValue({ data: pixels(120) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        for (const coloredName of [redName, blueName]) {
            expect(coloredName.style.fontWeight).toBe('400');
            expect(coloredName.style.textShadow).toBe('0 0.5px 1px rgba(0,0,0,0.05)');
            expect(parseColor(coloredName.style.color)).toEqual(parseColor(coloredName.dataset.scorePhotoColor!));
        }
        expect(defaultName.style.color).toBe('var(--photo-result-text, #f8fafc)');

        context.getImageData.mockReturnValue({ data: pixels(20) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(name.style.textShadow).toContain('1px 1px 0 rgba(255,255,255,0.7)');
        expect(defaultName.style.textShadow).toBe('none');
        expect(name.style.fontWeight).toBe('700');
        expect(defaultName.style.fontWeight).toBe('700');
        expect(name.style.color).toBe('rgb(17, 17, 17)');
        expect(name.textContent).toBe('Player');
        expect(defaultName.style.color).toBe('var(--photo-result-text, #f8fafc)');
        expect(yellowName.style.color).toBe('rgb(250, 204, 21)');
        expect(yellowName.style.textShadow).toBe(getContrastTextStyles('#facc15', 'dark').textShadow);
        expect(yellowName.style.filter).toBe('');
        expect(redName.style.color).toBe('rgb(239, 68, 68)');
        expect(blueName.style.color).toBe('rgb(59, 130, 246)');

        context.getImageData.mockReturnValue({ data: pixels(240) });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(name.style.textShadow).toBe('0 0.5px 1px rgba(0,0,0,0.05)');
        expect(yellowName.style.color).toBe(lightInk);
        expect(yellowName.style.fontWeight).toBe('400');
        expect(defaultName.style.fontWeight).toBe('400');
        expect(yellowName.dataset.scorePhotoColor).toBe('#facc15');
        expect(context.drawImage).toHaveBeenCalledTimes(10);
        expect(context.getImageData).toHaveBeenCalledTimes(10);
    });

    it('does not break sharing when pixel access is blocked', async () => {
        const { root, context } = setupPhoto();
        const name = document.createElement('span');
        name.dataset.scorePhotoName = 'custom';
        name.dataset.scorePhotoColor = '#facc15';
        name.style.color = '#998000';
        root.append(name);
        root.style.setProperty('--photo-result-background', 'hsl(0, 44%, 22%)');
        root.style.setProperty('--photo-result-card', 'hsl(0, 37%, 30%)');
        root.style.setProperty('--photo-result-identity', 'hsl(0, 37%, 26%)');
        root.style.setProperty('--photo-result-border', 'rgba(200,100,100,0.45)');
        context.getImageData.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
        await prepareScorePhotoTitle(root, new AbortController().signal);
        expect(root.style.getPropertyValue('--photo-title-color')).toBe(PHOTO_TITLE_FALLBACK.color);
        expect(root.style.getPropertyValue('--photo-title-shadow')).toBe(PHOTO_TITLE_FALLBACK.shadow);
        expect(root.style.getPropertyValue('--photo-title-background')).toBe(PHOTO_TITLE_FALLBACK.background);
        expect(root.style.getPropertyValue('--photo-result-background')).toBe(PHOTO_RESULT_FALLBACK.background);
        expect(root.style.getPropertyValue('--photo-result-card')).toBe(PHOTO_RESULT_FALLBACK.card);
        expect(root.style.getPropertyValue('--photo-result-identity')).toBe(PHOTO_RESULT_FALLBACK.identity);
        expect(root.style.getPropertyValue('--photo-result-border')).toBe(PHOTO_RESULT_FALLBACK.border);
        expect(name.style.color).toBe('rgb(250, 204, 21)');
    });

    it('uses the photo brightness for result surfaces and score text regardless of the app theme', async () => {
        const { root, context } = setupPhoto();
        const name = document.createElement('span');
        name.dataset.scorePhotoName = 'custom';
        name.style.color = '#facc15';
        root.append(name);
        const originalTheme = document.documentElement.getAttribute('data-theme');
        try {
            for (const photoPixels of [new Uint8ClampedArray([220, 205, 180, 255]), new Uint8ClampedArray([30, 20, 10, 255])]) {
                let firstStyles: string | undefined;
                let firstNameStyles: string | undefined;
                for (const appTheme of ['dark', 'light', 'sage']) {
                    document.documentElement.setAttribute('data-theme', appTheme);
                    context.getImageData.mockReturnValueOnce({ data: photoPixels });
                    await prepareScorePhotoTitle(root, new AbortController().signal);
                    const expected = getPhotoResultPalette(photoPixels);
                    for (const [key, value] of Object.entries(expected)) {
                        expect(root.style.getPropertyValue(`--photo-result-${key}`)).toBe(value);
                    }
                    if (firstStyles) expect(root.style.cssText).toBe(firstStyles);
                    if (firstNameStyles) expect(name.style.cssText).toBe(firstNameStyles);
                    firstStyles = root.style.cssText;
                    firstNameStyles = name.style.cssText;
                    expect(root.style.getPropertyValue('--photo-result-name-shadow')).toBe('');
                    expect(root.style.getPropertyValue('--photo-result-name-outline')).toBe('');
                }
            }
        } finally {
            if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', originalTheme);
        }
    });

    it('does not apply sampled colors or title styles after the composition has been cancelled', async () => {
        const { root, context } = setupPhoto();
        const name = document.createElement('span');
        name.dataset.scorePhotoName = 'custom';
        name.style.color = '#111111';
        name.style.textShadow = 'none';
        root.append(name);
        const controller = new AbortController();
        context.getImageData.mockImplementation(() => {
            controller.abort();
            return { data: pixels(255) };
        });
        await prepareScorePhotoTitle(root, controller.signal);
        expect(root.getAttribute('style')).toBeNull();
        expect(name.style.textShadow).toBe('none');
    });
});

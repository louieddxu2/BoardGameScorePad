import { expect, it, vi } from 'vitest';
import { COLOR_TONES } from '../colors';
import appCss from '../index.css?raw';
import { createColorReader, parseColor } from './color';
import { getPhotoNamePlateAppearance, getPhotoNamePlateBackground } from './photoNamePlate';

it('matches both scoreboard washes for every player color, including light ink and alpha', () => {
    for (const appearance of ['light', 'dark'] as const) {
        const theme = appearance === 'light'
            ? appCss.match(/html\[data-theme='light'\]\s*\{([^}]*)\}/)![1]
            : appCss.split('/* DEFAULT/DARK MODE */')[1].match(/:root\s*\{([^}]*)\}/)![1];
        const base = theme.match(/--c-grid-cell-bg:\s*(\d+) (\d+) (\d+);/)!.slice(1).map(Number);
        const wash = Number(theme.match(/--player-surface-tint-opacity:\s*([\d.]+);/)![1]);
        for (const name of Object.keys(COLOR_TONES)) {
            const ink = appCss.match(new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+);`))!.slice(1).map(Number);
            for (const alpha of [1, 0.4, 0]) {
                const background = getPhotoNamePlateBackground(`rgba(${ink.join(',')},${alpha})`, undefined, appearance);
                const result = parseColor(background)!;
                expect(result.a).toBe(1);
                expect(getPhotoNamePlateAppearance(background)).toBe(appearance);
                for (const [index, channel] of (['r', 'g', 'b'] as const).entries()) {
                    expect(result[channel]).toBe(Math.round(base[index] * (1 - wash * alpha) + ink[index] * wash * alpha));
                }
            }
        }
    }
});

it('shares CSS reads and uses fixed backings for unavailable or transparent ink', () => {
    document.documentElement.style.setProperty('--test-photo-ink', '255 255 255');
    const computed = vi.spyOn(globalThis, 'getComputedStyle');
    try {
        const read = createColorReader();
        expect(getPhotoNamePlateBackground('rgb(var(--test-photo-ink))', read))
            .toBe(getPhotoNamePlateBackground('#fff', read));
        getPhotoNamePlateBackground('rgb(var(--test-photo-ink))', read);
        expect(computed).toHaveBeenCalledTimes(1);
        for (const color of ['transparent', 'unknown-color']) {
            expect(parseColor(getPhotoNamePlateBackground(color))).toEqual({ r: 251, g: 250, b: 247, a: 1 });
            expect(parseColor(getPhotoNamePlateBackground(color, read, 'dark'))).toEqual({ r: 15, g: 23, b: 42, a: 1 });
        }
        const ink = { r: 255, g: 255, b: 255, a: 0.01 };
        const snapshot = { ...ink };
        getPhotoNamePlateBackground('imported', () => ink);
        expect(ink).toEqual(snapshot);
    } finally {
        computed.mockRestore();
        document.documentElement.style.removeProperty('--test-photo-ink');
    }
});

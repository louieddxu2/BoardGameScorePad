import { describe, expect, it } from 'vitest';
import appCss from './index.css?raw';
import appHtml from '../index.html?raw';
// @ts-expect-error Tailwind configuration is intentionally JavaScript, without a declaration file.
import config from '../tailwind.config.js';
import { collectThemeVariables } from '../scripts/theme-contract';
import { APP_THEME_ORDER, APP_THEMES, applyAppTheme, getThemeAppearance } from './theme';
import { parseColor } from './utils/color';
import { compositeColors, contrastOnBackground } from './utils/colorContrast';
import { getContrastTextStyles } from './utils/ui';

const { styles, root, themes } = collectThemeVariables(appCss);
const color = (theme: typeof APP_THEME_ORDER[number], token: string) => {
    const variables = themes.get(theme)!;
    const value = parseColor(`rgb(var(${token}))`, name => variables.get(name));
    expect(value, `${theme}: ${token} must resolve to paint`).not.toBeNull();
    return value!;
};

describe('Three-theme visual contract', () => {
    it('keeps the unlayered HTML backdrop semantic instead of overriding light CSS with fixed dark paint', () => {
        const inlineCss = [...appHtml.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<style>([\s\S]*?)<\/style>/g)]
            .map(match => match[1]).join('\n');
        const bodyPaint: Record<string, string> = {};
        collectThemeVariables(inlineCss).styles.walkRules('body', rule => {
            rule.walkDecls(declaration => { bodyPaint[declaration.prop] = declaration.value; });
        });
        expect(bodyPaint['background-color']).toBe('rgb(var(--c-app-bg))');
        expect(bodyPaint.color).toBe('rgb(var(--c-txt-primary))');
    });

    it('drives dark-only treatments from app selection and classifies sage as a light surface', () => {
        expect(config.darkMode).toEqual(['selector', '[data-theme-appearance="dark"]']);
        expect(APP_THEME_ORDER).toEqual(['dark', 'light', 'sage']);
        expect(getThemeAppearance('sage')).toBe('light');
        for (const theme of ['light', 'sage']) {
            let scheme: string | undefined;
            styles.walkRules(`html[data-theme='${theme}']`, rule => {
                rule.walkDecls('color-scheme', declaration => { scheme = declaration.value; });
            });
            expect(scheme).toBe('light');
        }
    });

    it('keeps compact text readable across new surfaces, tinted notices and solid controls', () => {
        for (const theme of APP_THEME_ORDER.filter(id => id !== 'dark')) {
            const backgrounds = ['--c-app-bg', '--c-app-bg-deep', '--c-surface-bg', '--c-surface-bg-alt', '--c-surface-hover', '--c-modal-bg-recessed', '--c-grid-cell-bg', '--c-grid-cell-bg-alt'];
            for (const bg of backgrounds) {
                for (const ink of ['--c-txt-primary', '--c-txt-secondary', '--c-txt-tertiary', '--c-txt-muted']) {
                    expect(contrastOnBackground(color(theme, ink), color(theme, bg)), `${theme}: ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
                }
            }
            for (const token of ['--c-brand-primary', '--c-brand-primary-deep', '--c-brand-secondary', '--c-status-danger', '--c-status-warning', '--c-status-info']) {
                const paint = color(theme, token);
                expect(contrastOnBackground(color(theme, '--c-txt-on-color'), paint), `${theme}: white on ${token}`).toBeGreaterThanOrEqual(4.5);
                const tinted = compositeColors({ ...paint, a: 0.2 }, color(theme, '--c-app-bg'));
                expect(contrastOnBackground(paint, tinted), `${theme}: ${token} on its notice tint`).toBeGreaterThanOrEqual(4.5);
            }
            for (const [ink, bg] of [
                ['--c-keypad-btn-text', '--c-keypad-btn-bg'],
                ['--c-modal-text-body', '--c-modal-bg'],
                ['--c-modal-btn-sec-text', '--c-modal-btn-sec-bg'],
                ['--c-btn-cloud-text', '--c-btn-cloud-bg'],
            ]) expect(contrastOnBackground(color(theme, ink), color(theme, bg)), `${theme}: ${ink}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('retains all player palette primitives and gives new themes the existing light-ink protection', () => {
        for (const theme of Object.keys(APP_THEMES) as typeof APP_THEME_ORDER) {
            for (const token of [...root.keys()].filter(name => name.startsWith('--c-p-'))) {
                expect(themes.get(theme)?.get(token)).toBe(root.get(token));
            }
        }
        for (const ink of ['rgb(var(--c-p-white))', 'rgb(var(--c-p-yellow))', '#ffffcc']) {
            expect(getContrastTextStyles(ink, 'sage')).toEqual(getContrastTextStyles(ink, 'light'));
            expect(getContrastTextStyles(ink, 'sage').textShadow).toContain('rgba(0,0,0,0.6)');
        }
        expect(getContrastTextStyles('rgb(var(--c-p-black))', 'sage', { isTextureMode: true }))
            .toEqual(getContrastTextStyles('rgb(var(--c-p-black))', 'dark', { isTextureMode: true }));
    });

    it('separates quiet light table stripes from recessed panels and preserves dark tint strengths', () => {
        for (const theme of ['light', 'sage'] as const) {
            const stripeRatio = contrastOnBackground(color(theme, '--c-grid-cell-bg-alt'), color(theme, '--c-grid-cell-bg'))!;
            expect(stripeRatio, `${theme}: stripe must remain visible but understated`).toBeGreaterThan(1.03);
            expect(stripeRatio).toBeLessThan(1.08);
            expect(color(theme, '--c-grid-cell-bg-alt')).not.toEqual(color(theme, '--c-surface-bg-alt'));
            expect(color(theme, '--c-grid-auto-bg')).toEqual(color(theme, '--c-grid-cell-bg'));
            expect(color(theme, '--c-grid-auto-bg-alt')).toEqual(color(theme, '--c-grid-cell-bg-alt'));
            expect(color(theme, '--c-grid-auto-border')).toEqual(color(theme, '--c-grid-cell-border'));
            expect(Number(themes.get(theme)?.get('--player-surface-tint-opacity'))).toBeLessThanOrEqual(0.05);
        }
        expect(color('dark', '--c-grid-auto-bg-alt')).toEqual(color('dark', '--c-grid-auto-bg'));
        expect(color('dark', '--c-grid-auto-border')).toEqual(color('dark', '--c-grid-auto-bg'));
        expect(color('dark', '--c-grid-header-border')).toEqual(color('dark', '--c-surface-border'));
        expect(color('dark', '--c-player-header-neutral-bg')).toEqual(color('dark', '--c-surface-bg-alt'));
        expect(Number(root.get('--player-surface-tint-opacity'))).toBeCloseTo(32 / 255, 6);
        expect(Number(root.get('--player-surface-border-opacity'))).toBeCloseTo(64 / 255, 6);
    });

    it('pairs dark-overlay ink with the actual badge and hint paint, not light-theme body text', () => {
        for (const theme of APP_THEME_ORDER) {
            // White is the brightest possible photo/surface behind these dark overlays.
            const white = { r: 255, g: 255, b: 255, a: 1 };
            const backdrop = color(theme, '--c-modal-backdrop');
            const badge = compositeColors({ ...backdrop, a: 0.7 }, white);
            const hint = compositeColors({ ...backdrop, a: 0.9 }, white);
            expect(contrastOnBackground(color(theme, '--c-player-badge-ink'), badge), `${theme}: badge text`).toBeGreaterThanOrEqual(4.5);
            expect(contrastOnBackground(color(theme, '--c-player-badge-muted-ink'), badge), `${theme}: muted badge icon`).toBeGreaterThanOrEqual(3);
            expect(contrastOnBackground(color(theme, '--c-input-hint-ink'), hint), `${theme}: swipe hint`).toBeGreaterThanOrEqual(4.5);
        }
        expect(color('dark', '--c-player-badge-ink')).toEqual(color('dark', '--c-txt-primary'));
        expect(color('dark', '--c-player-badge-muted-ink')).toEqual(color('dark', '--c-txt-muted'));
        expect(color('dark', '--c-input-hint-ink')).toEqual(color('dark', '--c-brand-primary'));
    });

    it('uses the selected palette for mobile browser chrome without a second hardcoded palette', () => {
        const previous = document.documentElement.getAttribute('data-theme');
        const previousAppearance = document.documentElement.getAttribute('data-theme-appearance');
        const style = document.createElement('style');
        style.textContent = [...appCss.matchAll(/(?::root|html\[data-theme='(?:light|sage)'\])\s*\{[^}]*\}/g)]
            .map(match => match[0]).join('\n');
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.append(style, meta);
        try {
            for (const theme of APP_THEME_ORDER) {
                document.documentElement.removeAttribute('data-theme');
                applyAppTheme(theme);
                const expected = color(theme, '--c-app-bg');
                expect(parseColor(meta.content)).toEqual(expected);
            }
        } finally {
            style.remove();
            meta.remove();
            if (previous === null) document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', previous);
            if (previousAppearance === null) document.documentElement.removeAttribute('data-theme-appearance');
            else document.documentElement.setAttribute('data-theme-appearance', previousAppearance);
        }
    });
});

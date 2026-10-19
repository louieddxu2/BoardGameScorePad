/** Theme identity is independent of surface brightness and saved player colors. */
export const APP_THEMES = {
    dark: { appearance: 'dark', labelKey: 'dash_theme_dark' },
    light: { appearance: 'light', labelKey: 'dash_theme_light' },
    sage: { appearance: 'light', labelKey: 'dash_theme_sage' },
} as const;

export type AppTheme = keyof typeof APP_THEMES;
export type ThemeAppearance = 'dark' | 'light';
export const APP_THEME_ORDER = Object.keys(APP_THEMES) as AppTheme[];

export function isAppTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_THEMES, value);
}

export function resolveAppTheme(value: unknown): AppTheme {
    return isAppTheme(value) ? value : 'dark';
}

export function readStoredAppTheme(): AppTheme {
    try { return resolveAppTheme(localStorage.getItem('app_theme_mode')); }
    catch { return 'dark'; } // Blocked browser storage must not prevent startup.
}

export function nextAppTheme(theme: AppTheme): AppTheme {
    return APP_THEME_ORDER[(APP_THEME_ORDER.indexOf(theme) + 1) % APP_THEME_ORDER.length];
}

export function getThemeAppearance(theme: AppTheme): ThemeAppearance {
    return APP_THEMES[theme].appearance;
}

/** Apply before rendering consumers that resolve custom-color outlines from the DOM. */
export function applyAppTheme(theme: AppTheme): void {
    const appearance = getThemeAppearance(theme);
    if (document.documentElement.getAttribute('data-theme') !== theme
        || document.documentElement.getAttribute('data-theme-appearance') !== appearance) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme-appearance', appearance);
        const browserColor = document.querySelector('meta[name="theme-color"]');
        if (browserColor) {
            const channels = getComputedStyle(document.documentElement).getPropertyValue('--c-app-bg').trim();
            if (channels) browserColor.setAttribute('content', `rgb(${channels})`);
        }
    }
}

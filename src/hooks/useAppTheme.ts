import { useEffect, useRef, useState } from 'react';
import { applyAppTheme, isAppTheme, nextAppTheme, readStoredAppTheme, type AppTheme } from '../theme';

/** One owner for theme persistence, restoration and the document selector. */
export function useAppTheme(markSystemDirty: () => void) {
    const [themeMode, setThemeMode] = useState<AppTheme>(readStoredAppTheme);
    const currentTheme = useRef(themeMode);

    useEffect(() => {
        applyAppTheme(themeMode);
        try { localStorage.setItem('app_theme_mode', themeMode); }
        catch { /* Keep switching usable for this visit when storage is blocked. */ }
    }, [themeMode]);

    const selectTheme = (theme: AppTheme) => {
        currentTheme.current = theme;
        applyAppTheme(theme);
        setThemeMode(theme);
    };

    const toggleTheme = () => {
        selectTheme(nextAppTheme(currentTheme.current));
        markSystemDirty();
    };

    // Unknown values from a newer/invalid backup must not erase the current choice.
    const restoreTheme = (value: unknown) => {
        if (isAppTheme(value)) selectTheme(value);
    };

    return { themeMode, toggleTheme, restoreTheme };
}

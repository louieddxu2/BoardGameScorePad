import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppTheme } from './useAppTheme';
import { getCurrentTheme } from '../utils/ui';

describe('Application theme ownership', () => {
    beforeEach(() => { localStorage.removeItem('app_theme_mode'); });
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.removeItem('app_theme_mode');
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-theme-appearance');
    });

    it('cycles all three themes, persists the choice and restores it on remount', () => {
        const dirty = vi.fn();
        const first = renderHook(() => {
            const state = useAppTheme(dirty);
            return { ...state, renderedTheme: getCurrentTheme() };
        });
        for (const expected of ['light', 'sage', 'dark', 'light', 'sage']) {
            act(() => first.result.current.toggleTheme());
            expect(first.result.current.themeMode).toBe(expected);
            expect(first.result.current.renderedTheme).toBe(expected);
            expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
            expect(document.documentElement.getAttribute('data-theme-appearance')).toBe(expected === 'dark' ? 'dark' : 'light');
            expect(localStorage.getItem('app_theme_mode')).toBe(expected);
        }
        expect(dirty).toHaveBeenCalledTimes(5);
        first.unmount();
        const second = renderHook(() => useAppTheme(dirty));
        expect(second.result.current.themeMode).toBe('sage');
        expect(dirty).toHaveBeenCalledTimes(5);
    });

    it('accepts old and new backup theme values but ignores malformed preferences', () => {
        const dirty = vi.fn();
        const { result } = renderHook(() => useAppTheme(dirty));
        for (const theme of ['light', 'dark', 'sage']) {
            act(() => result.current.restoreTheme(theme));
            expect(result.current.themeMode).toBe(theme);
        }
        for (const value of ['future-theme', 'toString', '', null, 1, {}]) {
            act(() => result.current.restoreTheme(value));
            expect(result.current.themeMode).toBe('sage');
        }
        expect(dirty).not.toHaveBeenCalled();
    });

    it('falls back to the original dark theme for invalid stored data', () => {
        localStorage.setItem('app_theme_mode', 'unknown');
        const { result } = renderHook(() => useAppTheme(vi.fn()));
        expect(result.current.themeMode).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('can still switch themes when browser storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
        const { result } = renderHook(() => useAppTheme(vi.fn()));
        expect(result.current.themeMode).toBe('dark');
        act(() => result.current.toggleTheme());
        expect(result.current.themeMode).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
});

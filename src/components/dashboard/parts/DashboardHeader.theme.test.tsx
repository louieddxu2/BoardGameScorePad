import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardHeader from './DashboardHeader';
import { LanguageContext } from '../../../i18n';
import { useAppTheme } from '../../../hooks/useAppTheme';

afterEach(() => {
    localStorage.removeItem('app_theme_mode');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-appearance');
});

it('cycles from the actual top-left control and exposes current/next themes to touch and keyboard users', async () => {
    localStorage.setItem('app_theme_mode', 'dark');
    const noop = vi.fn();
    function Header() {
        const { themeMode, toggleTheme } = useAppTheme(noop);
        return <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: noop }}>
            <DashboardHeader isSearchActive={false} setIsSearchActive={noop} searchQuery="" setSearchQuery={noop}
                isInstalled={false} canInstall={false} onInstallClick={noop} onShowInstallGuide={noop}
                viewMode="library" setViewMode={noop} themeMode={themeMode} onToggleTheme={toggleTheme}
                isConnected={false} isSyncing={false} onCloudClick={noop} onTriggerInspector={noop} />
        </LanguageContext.Provider>;
    }
    render(<Header />);
    const button = screen.getByRole('button', { name: '目前為深色，切換為暖紙淺色' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('min-w-[44px]', 'min-h-[44px]');
    fireEvent.click(button);
    expect(button).toHaveAccessibleName('目前為暖紙淺色，切換為鼠尾草綠');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAccessibleName('目前為鼠尾草綠，切換為深色');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sage');
    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

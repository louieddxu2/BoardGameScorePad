import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardHeader from './DashboardHeader';
import { LanguageContext } from '../../../i18n';
import { clearCloudSession, SESSION_EVENT, SESSION_STORAGE_KEY } from '../../../services/cloud/cloudSession';

afterEach(() => clearCloudSession());

const renderHeader = (isConnected: boolean) => {
  const noop = vi.fn();
  return render(
    <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: noop }}>
      <DashboardHeader isSearchActive={false} setIsSearchActive={noop} searchQuery="" setSearchQuery={noop}
        isInstalled={false} canInstall={false} onInstallClick={noop} onShowInstallGuide={noop}
        viewMode="library" setViewMode={noop} themeMode="dark" onToggleTheme={noop}
        isConnected={isConnected} isSyncing={false} onCloudClick={noop} onTriggerInspector={noop} />
    </LanguageContext.Provider>
  );
};

it('marks the cloud icon when this device holds the owner sign-in, whatever the Drive state', () => {
  renderHeader(false);
  expect(screen.queryByTestId('cloud-owner-badge')).toBeNull();

  act(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 's1.a.b', expiresAt: Date.now() + 86_400_000, isAdmin: true }));
    window.dispatchEvent(new Event(SESSION_EVENT));
  });
  const badge = screen.getByTestId('cloud-owner-badge');
  expect(badge.closest('button')?.getAttribute('title')).toContain('此裝置已登入管理員');

  act(() => clearCloudSession());
  expect(screen.queryByTestId('cloud-owner-badge')).toBeNull();
});

it('shows no badge for a signed-in device without admin rights', () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 's1.a.b', expiresAt: Date.now() + 86_400_000, isAdmin: false }));
  renderHeader(true);
  expect(screen.queryByTestId('cloud-owner-badge')).toBeNull();
});

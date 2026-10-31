import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsView } from './SettingsView';
import { LanguageContext, LanguageProvider } from '../../../i18n';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { BackupError } from '../../../services/offlineBackup/errors';
import type { OfflineBackupResult } from '../../../services/offlineBackup/import';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), exportData: vi.fn(), importData: vi.fn(), readData: vi.fn(),
  openCloud: vi.fn(), openBgStats: vi.fn(), openCatalog: vi.fn(), selectTheme: vi.fn(), busy: vi.fn() }));
vi.mock('../../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }));
vi.mock('../../../services/offlineBackup/export', () => ({ exportOfflineBackup: mocks.exportData }));
vi.mock('../../../services/offlineBackup/import', () => ({ applyOfflineBackup: mocks.importData }));
vi.mock('../../../services/offlineBackup/validate', () => ({ validateOfflineBackup: mocks.readData }));
vi.mock('../../../services/offlineBackup/preview', () => ({
  previewBackupRecords: () => ({ total: 12, recent: [
    { name: 'Carcassonne', endTime: new Date(2026, 9, 28, 20).getTime() },
    { name: 'Splendor', endTime: new Date(2026, 9, 27, 20).getTime() },
  ] }),
  previewDeviceRecords: async () => ({ total: 0, recent: [] }),
}));
const backup = { createdAt: new Date(2026, 9, 28, 21, 30).getTime(), issues: [] };
beforeEach(() => { mocks.readData.mockResolvedValue(backup); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderSettings = (busy = vi.fn()) => render(<LanguageContext.Provider value={{ language: 'en', setLanguage: vi.fn() }}>
  <SettingsView themeMode="sage" onSelectTheme={vi.fn()} onBusyChange={busy}
    zoomLevel={1} onZoomChange={vi.fn()} isCloudConnected={false} isCloudSyncing={false} onOpenCloud={vi.fn()}
    onOpenBgStats={mocks.openBgStats} onOpenGameCatalogImport={mocks.openCatalog} />
</LanguageContext.Provider>);

function SettingsWithLivePreferences() {
  const { zoomLevel, setZoomLevel } = useMobileZoom();
  return <SettingsView themeMode="sage" onSelectTheme={mocks.selectTheme} onBusyChange={mocks.busy}
    zoomLevel={zoomLevel} onZoomChange={setZoomLevel} isCloudConnected={false} isCloudSyncing={false} onOpenCloud={mocks.openCloud}
    onOpenBgStats={mocks.openBgStats} onOpenGameCatalogImport={mocks.openCatalog} />;
}

it('uses the existing zoom and language owners and opens cloud management only when requested', () => {
  const oldLanguage = localStorage.getItem('app_language');
  const oldZoom = localStorage.getItem('app_zoom_level');
  const oldFont = document.documentElement.style.fontSize;
  const oldFactor = document.documentElement.style.getPropertyValue('--app-zoom-level');
  const oldLang = document.documentElement.lang;
  localStorage.setItem('app_language', 'en');
  localStorage.setItem('app_zoom_level', '1.15');
  const swipeStart = vi.fn();
  const view = render(<LanguageProvider><div onTouchStart={swipeStart}><SettingsWithLivePreferences /></div></LanguageProvider>);
  try {
    const slider = screen.getByRole('slider', { name: 'Interface size' });
    expect(slider).toHaveValue('115');
    expect(screen.getByText('115%')).toBeInTheDocument();
    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(slider, { touches: [] });
    expect(swipeStart).not.toHaveBeenCalled();
    fireEvent.change(slider, { target: { value: '125' } });
    expect(screen.getByText('125%')).toBeInTheDocument();
    expect(localStorage.getItem('app_zoom_level')).toBe('1.25');
    expect(document.documentElement.style.fontSize).toBe('20px');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to 100%' }));
    expect(slider).toHaveValue('100');
    expect(localStorage.getItem('app_zoom_level')).toBe('1');
    expect(screen.queryByRole('button', { name: 'Reset to 100%' })).toBeNull();
    expect(mocks.openCloud).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cloud backup/ }));
    expect(mocks.openCloud).toHaveBeenCalledTimes(1);
    expect(mocks.openCatalog).not.toHaveBeenCalled();
    expect(mocks.openBgStats).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /BGG \/ GeekGroup game data/ }));
    expect(mocks.openCatalog).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /BG Stats import \/ export/ }));
    expect(mocks.openBgStats).toHaveBeenCalledTimes(1);
    const themes = screen.getByRole('radiogroup', { name: 'Appearance' });
    expect(within(themes).getByRole('radio', { name: 'Sage' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(themes).getByRole('radio', { name: 'Sage' }));
    expect(mocks.selectTheme).not.toHaveBeenCalled();
    fireEvent.click(within(themes).getByRole('radio', { name: 'Warm paper' }));
    expect(mocks.selectTheme).toHaveBeenCalledWith('light');
    fireEvent.click(screen.getByRole('radio', { name: '繁體中文' }));
    expect(localStorage.getItem('app_language')).toBe('zh-TW');
    expect(within(screen.getByRole('radiogroup', { name: '語言' })).getByRole('radio', { name: '繁體中文' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /雲端備份/ })).toBeInTheDocument();
  } finally {
    view.unmount();
    for (const [key, previous] of [['app_language', oldLanguage], ['app_zoom_level', oldZoom]]) {
      if (previous === null) localStorage.removeItem(key!);
      else localStorage.setItem(key!, previous!);
    }
    document.documentElement.style.fontSize = oldFont;
    if (oldFactor) document.documentElement.style.setProperty('--app-zoom-level', oldFactor);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    document.documentElement.lang = oldLang;
  }
});

it('waits for import to commit and the completion acknowledgement before reloading', async () => {
  let finishImport!: (result: OfflineBackupResult) => void;
  let acknowledge!: (value: boolean) => void;
  mocks.confirm.mockResolvedValueOnce(true).mockImplementationOnce(() => new Promise<boolean>(resolve => { acknowledge = resolve; }));
  mocks.importData.mockImplementationOnce(() => new Promise<OfflineBackupResult>(resolve => { finishImport = resolve; }));
  const reload = vi.fn();
  vi.stubGlobal('window', new Proxy(window, { get(target, property) {
    return property === 'location' ? { reload } : Reflect.get(target, property, target);
  } }));
  const busy = vi.fn();
  renderSettings(busy);
  fireEvent.change(screen.getByLabelText('Restore from backup'), {
    target: { files: [new File(['zip'], 'backup.zip', { type: 'application/zip' })] },
  });
  await waitFor(() => expect(mocks.importData).toHaveBeenCalledTimes(1));
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog', { name: 'Validating and importing' })).toBeInTheDocument();
  expect(reload).not.toHaveBeenCalled();
  await act(async () => { finishImport({ issues: [] }); });
  expect(mocks.confirm).toHaveBeenLastCalledWith({
    title: 'Import complete', message: 'All data imported. Press Confirm to reload the page and apply settings.',
    confirmText: 'Confirm', hideCancel: true,
  });
  expect(screen.queryByRole('dialog', { name: 'Validating and importing' })).not.toBeInTheDocument();
  expect(busy).toHaveBeenLastCalledWith(true);
  expect(reload).not.toHaveBeenCalled();
  expect(await screen.findByText(/^All data imported/)).toHaveAttribute('role', 'status');
  await act(async () => { acknowledge(true); });
  expect(reload).toHaveBeenCalledTimes(1);
  expect(busy).toHaveBeenLastCalledWith(false);
});

it('shows damage details for the current import and clears them when settings is reopened', async () => {
  const result: OfflineBackupResult = { issues: [{ path: '_History/game/photo.jpg', reason: 'missing' }] };
  mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  mocks.importData.mockResolvedValueOnce(result);
  const view = renderSettings();
  expect(screen.queryByText(/This import: missing or damaged items/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Restore from backup'), { target: { files: [new File(['zip'], 'backup.zip')] } });
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
  expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'Usable data imported', message: expect.stringContaining('_History/game/photo.jpg'),
  }));
  expect(screen.getByText(/^Usable data imported\./)).toHaveAttribute('role', 'status');
  expect(screen.getByText('This import: missing or damaged items (1)')).toBeInTheDocument();
  view.unmount();
  renderSettings();
  expect(screen.queryByText(/This import: missing or damaged items/)).not.toBeInTheDocument();
});

it('previews the chosen backup before replacing data and rejects invalid files before asking', async () => {
  mocks.confirm.mockResolvedValueOnce(false);
  renderSettings();
  const file = new File(['invalid'], 'backup.zip', { type: 'application/zip' });
  const input = screen.getByLabelText('Restore from backup');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
  expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({
    isDangerous: true, confirmText: 'Replace and import',
    message: expect.stringContaining('Built-in scoreboards are preserved'),
  }));
  expect(mocks.confirm.mock.calls[0][0].message).toContain([
    'File: backup.zip', 'Backed up: 2026-10-28 21:30', '',
    'Latest records in this backup (12 total):', '・2026-10-28 Carcassonne', '・2026-10-27 Splendor', '',
    'Latest record on this device (0 total):', '・No game records',
  ].join('\n'));
  expect(mocks.importData).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Restore from backup/ }))
    .toHaveAccessibleDescription('Replaces all data on this device');
  mocks.readData.mockRejectedValueOnce(new BackupError('invalid', 'table: history'));
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('alert');
  expect(mocks.readData).toHaveBeenLastCalledWith(file, expect.any(Function));
  expect(mocks.importData).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data has not been replaced');
  expect(screen.getByRole('alert')).toHaveTextContent('Check location: table: history');
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
});

it('locks the controls during export and downloads a ZIP with the backup filename', async () => {
  let finish!: (blob: Blob) => void;
  mocks.exportData.mockImplementation((_progress, onMissing) => {
    onMissing(['old-background']);
    return new Promise<Blob>(resolve => { finish = resolve; });
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const createUrl = vi.fn(() => 'blob:backup');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
  const busy = vi.fn();
  localStorage.removeItem('settings_last_export_at');
  renderSettings(busy);
  expect(screen.getByText('No backup exported on this device yet')).toBeInTheDocument();
  const exportButton = screen.getByRole('button', { name: /Export backup/ });
  fireEvent.click(exportButton);
  const progress = screen.getByRole('dialog', { name: 'Exporting' });
  expect(progress.parentElement).toBe(document.body);
  expect(document.activeElement).toBe(progress);
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  expect(progress.dispatchEvent(tab)).toBe(false);
  expect(exportButton).toBeDisabled();
  expect(screen.getByRole('button', { name: /Restore from backup/ })).toBeDisabled();
  expect(screen.getByRole('slider', { name: 'Interface size' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'English' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Sage' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Cloud backup/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /BGG \/ GeekGroup game data/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /BG Stats import \/ export/ })).toBeDisabled();
  expect(busy).toHaveBeenLastCalledWith(true);
  const blob = new Blob(['zip'], { type: 'application/zip' });
  await act(async () => { finish(blob); });
  expect(createUrl).toHaveBeenCalledWith(blob);
  const anchor = click.mock.instances[0] as HTMLAnchorElement;
  expect(anchor.download).toMatch(/^BoardGameScorePad-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(anchor.href).toBe('blob:backup');
  expect(busy).toHaveBeenLastCalledWith(false);
  expect(exportButton).not.toBeDisabled();
  expect(screen.getByText(/^Readable local data exported/)).toHaveTextContent('Missing or damaged items and image references were recorded');
  expect(screen.getByText(/^Last export: \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  expect(localStorage.getItem('settings_last_export_at')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  localStorage.removeItem('settings_last_export_at');
});

it('shows the latest release notes in the reader language and keeps earlier updates collapsed', async () => {
  const { RELEASE_NOTES } = await import('../../../data/releaseNotes');
  renderSettings();
  const [latest, previous] = RELEASE_NOTES;
  expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
  expect(screen.getByText(latest.date)).toBeInTheDocument();
  expect(screen.getByText(latest.items[0].en)).toBeVisible();
  expect(screen.queryByText(latest.items[0].zh)).toBeNull();
  const earlier = screen.getByText('Earlier updates').closest('details')!;
  expect(earlier).not.toHaveAttribute('open');
  expect(earlier).toHaveTextContent(previous.items[0].en);
});

it('shows the installed service worker revision next to the About heading', async () => {
  vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['other-cache', 'boardgame-scorepad-cache-2026-10-31-02']) });
  renderSettings();
  expect(await screen.findByText('Version 2026-10-31-02')).toBeInTheDocument();
});

it('keeps release notes newest first with bilingual text', async () => {
  const { RELEASE_NOTES } = await import('../../../data/releaseNotes');
  const dates = RELEASE_NOTES.map(note => note.date);
  expect(new Set(dates).size).toBe(dates.length);
  expect([...dates].sort().reverse()).toEqual(dates);
  for (const note of RELEASE_NOTES) {
    expect(note.items.length).toBeGreaterThan(0);
    for (const item of note.items) expect(item.zh.trim() && item.en.trim()).toBeTruthy();
  }
});

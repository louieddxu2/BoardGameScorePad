import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsView } from './SettingsView';
import { LanguageContext, LanguageProvider } from '../../../i18n';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { BackupError } from '../../../services/offlineBackup/errors';
import type { OfflineBackupResult } from '../../../services/offlineBackup/import';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), exportData: vi.fn(), importData: vi.fn(),
  openCloud: vi.fn(), openBgStats: vi.fn(), openCatalog: vi.fn(), toggleTheme: vi.fn(), busy: vi.fn() }));
vi.mock('../../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }));
vi.mock('../../../services/offlineBackup/export', () => ({ exportOfflineBackup: mocks.exportData }));
vi.mock('../../../services/offlineBackup/import', () => ({ importOfflineBackup: mocks.importData }));
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderSettings = (busy = vi.fn()) => render(<LanguageContext.Provider value={{ language: 'en', setLanguage: vi.fn() }}>
  <SettingsView themeMode="sage" onToggleTheme={vi.fn()} onBusyChange={busy}
    zoomLevel={1} onZoomChange={vi.fn()} isCloudConnected={false} isCloudSyncing={false} onOpenCloud={vi.fn()}
    onOpenBgStats={mocks.openBgStats} onOpenGameCatalogImport={mocks.openCatalog} />
</LanguageContext.Provider>);

function SettingsWithLivePreferences() {
  const { zoomLevel, setZoomLevel } = useMobileZoom();
  return <SettingsView themeMode="sage" onToggleTheme={mocks.toggleTheme} onBusyChange={mocks.busy}
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
    expect(mocks.openCloud).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cloud backup/ }));
    expect(mocks.openCloud).toHaveBeenCalledTimes(1);
    expect(mocks.openCatalog).not.toHaveBeenCalled();
    expect(mocks.openBgStats).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Import game data/ }));
    expect(mocks.openCatalog).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /BG Stats import \/ export/ }));
    expect(mocks.openBgStats).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Appearance/ }));
    expect(mocks.toggleTheme).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'zh-TW' } });
    expect(localStorage.getItem('app_language')).toBe('zh-TW');
    expect(screen.getByRole('combobox', { name: '語言' })).toHaveValue('zh-TW');
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
  fireEvent.change(screen.getByLabelText('Import all data'), {
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
  fireEvent.change(screen.getByLabelText('Import all data'), { target: { files: [new File(['zip'], 'backup.zip')] } });
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

it('asks for destructive replacement confirmation before importing and keeps cancelled data untouched', async () => {
  mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  mocks.importData.mockRejectedValue(new BackupError('invalid', 'table: history'));
  renderSettings();
  const file = new File(['invalid'], 'backup.zip', { type: 'application/zip' });
  const input = screen.getByLabelText('Import all data');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
  expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({
    isDangerous: true, confirmText: 'Replace and import',
    message: expect.stringContaining('Built-in scoreboards are preserved'),
  }));
  expect(mocks.importData).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('alert');
  expect(mocks.importData).toHaveBeenCalledTimes(1);
  expect(mocks.importData).toHaveBeenCalledWith(file, expect.any(Function));
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data has not been replaced');
  expect(screen.getByRole('alert')).toHaveTextContent('Check location: table: history');
  expect(mocks.confirm).toHaveBeenCalledTimes(2);
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
  renderSettings(busy);
  const exportButton = screen.getByRole('button', { name: /Export all data/ });
  fireEvent.click(exportButton);
  const progress = screen.getByRole('dialog', { name: 'Exporting' });
  expect(progress.parentElement).toBe(document.body);
  expect(document.activeElement).toBe(progress);
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  expect(progress.dispatchEvent(tab)).toBe(false);
  expect(exportButton).toBeDisabled();
  expect(screen.getByRole('button', { name: /Import all data/ })).toBeDisabled();
  expect(screen.getByRole('slider', { name: 'Interface size' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Language' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Cloud backup/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Import game data/ })).toBeDisabled();
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
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsView } from './SettingsView';
import { LanguageContext } from '../../../i18n';
import { BackupError } from '../../../services/offlineBackup/errors';
import type { OfflineBackupResult } from '../../../services/offlineBackup/import';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), exportData: vi.fn(), importData: vi.fn() }));
vi.mock('../../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }));
vi.mock('../../../services/offlineBackup/export', () => ({ exportOfflineBackup: mocks.exportData }));
vi.mock('../../../services/offlineBackup/import', () => ({ importOfflineBackup: mocks.importData }));
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderSettings = (busy = vi.fn()) => render(<LanguageContext.Provider value={{ language: 'en', setLanguage: vi.fn() }}>
  <SettingsView themeMode="sage" onToggleTheme={vi.fn()} onBusyChange={busy} />
</LanguageContext.Provider>);

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
  expect(await screen.findByRole('status')).toHaveTextContent('All data imported');
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
  expect(screen.getByRole('status')).toHaveTextContent('Usable data imported');
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
  expect(busy).toHaveBeenLastCalledWith(true);
  const blob = new Blob(['zip'], { type: 'application/zip' });
  await act(async () => { finish(blob); });
  expect(createUrl).toHaveBeenCalledWith(blob);
  const anchor = click.mock.instances[0] as HTMLAnchorElement;
  expect(anchor.download).toMatch(/^BoardGameScorePad-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(anchor.href).toBe('blob:backup');
  expect(busy).toHaveBeenLastCalledWith(false);
  expect(exportButton).not.toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Missing or damaged items and image references were recorded');
});

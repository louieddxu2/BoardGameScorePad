import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsView } from './SettingsView';
import { LanguageContext } from '../../../i18n';
import { BackupError } from '../../../services/offlineBackup/errors';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), exportData: vi.fn(), importData: vi.fn() }));
vi.mock('../../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }));
vi.mock('../../../services/offlineBackup/export', () => ({ exportOfflineBackup: mocks.exportData }));
vi.mock('../../../services/offlineBackup/import', () => ({ importOfflineBackup: mocks.importData }));
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderSettings = (busy = vi.fn()) => render(<LanguageContext.Provider value={{ language: 'en', setLanguage: vi.fn() }}>
  <SettingsView themeMode="sage" onToggleTheme={vi.fn()} onBusyChange={busy} />
</LanguageContext.Provider>);

it('shows a successful import result even when the browser does not carry out reload', async () => {
  mocks.confirm.mockResolvedValue(true);
  mocks.importData.mockResolvedValue(undefined);
  const reload = vi.fn();
  vi.stubGlobal('window', new Proxy(window, { get(target, property) {
    return property === 'location' ? { reload } : Reflect.get(target, property, target);
  } }));
  renderSettings();
  fireEvent.change(screen.getByLabelText('Import all data'), {
    target: { files: [new File(['zip'], 'backup.zip', { type: 'application/zip' })] },
  });
  await waitFor(() => expect(mocks.importData).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole('status')).toHaveTextContent('All data imported');
  expect(reload).toHaveBeenCalledTimes(1);
});

it('asks for destructive replacement confirmation before importing and keeps cancelled data untouched', async () => {
  mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  mocks.importData.mockRejectedValue(new BackupError('invalid'));
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
  expect(screen.getByRole('status')).toHaveTextContent('Image references without matching local files were preserved');
});

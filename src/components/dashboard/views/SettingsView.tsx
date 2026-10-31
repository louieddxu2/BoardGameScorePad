import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Download, Upload, Loader2, Cloud, CloudOff, Database, FileJson } from 'lucide-react';
import type { AppTheme } from '../../../theme';
import { useSettingsTranslation } from '../../../i18n/settings';
import { SettingsPreferences } from './SettingsPreferences';
import { SettingsAbout } from './SettingsAbout';
import { NavRow, SettingsGroup } from './SettingsRows';
import { useConfirm } from '../../../hooks/useConfirm';
import { BackupError } from '../../../services/offlineBackup/errors';
import { exportOfflineBackup } from '../../../services/offlineBackup/export';
import { applyOfflineBackup } from '../../../services/offlineBackup/import';
import { validateOfflineBackup } from '../../../services/offlineBackup/validate';
import { previewBackupRecords, previewDeviceRecords, type RecordPreview } from '../../../services/offlineBackup/preview';
import type { OfflineBackupIssue } from '../../../types';

const LAST_EXPORT_KEY = 'settings_last_export_at';

const pad = (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function readLastExport() {
  try { return localStorage.getItem(LAST_EXPORT_KEY); } catch { return null; }
}

export function SettingsView({ themeMode, onSelectTheme, onBusyChange, zoomLevel, onZoomChange,
  isCloudConnected, isCloudSyncing, onOpenCloud, onOpenBgStats, onOpenGameCatalogImport }: {
  themeMode: AppTheme; onSelectTheme: (theme: AppTheme) => void; onBusyChange: (busy: boolean) => void;
  zoomLevel: number; onZoomChange: (value: number) => void;
  isCloudConnected: boolean; isCloudSyncing: boolean; onOpenCloud: () => void;
  onOpenBgStats: () => void; onOpenGameCatalogImport: () => void;
}) {
  const t = useSettingsTranslation();
  const { confirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [operation, setOperation] = useState<'exporting' | 'reading' | 'importing' | null>(null);
  const [filename, setFilename] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean; warning?: boolean } | null>(null);
  const [importIssues, setImportIssues] = useState<OfflineBackupIssue[]>([]);
  // Records that a file was produced on this device; whether it was kept is outside the app's view.
  const [lastExport, setLastExport] = useState(readLastExport);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  useEffect(() => {
    if (!operation) return;
    const previousFocus = document.activeElement;
    progressRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [operation]);

  const run = async (mode: 'exporting' | 'importing', file?: File) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFeedback(null);
    onBusyChange(true);
    setImportIssues([]);
    setOperation(mode === 'importing' ? 'reading' : mode);
    setFilename('');
    try {
      if (mode === 'exporting') {
        let hasMissingReferences = false;
        const blob = await exportOfflineBackup(setFilename, ids => { hasMissingReferences = ids.length > 0; });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = formatDate(new Date());
        link.download = `BoardGameScorePad-${date}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setLastExport(date);
        try { localStorage.setItem(LAST_EXPORT_KEY, date); } catch { /* The reminder is optional. */ }
        setFeedback({ text: t(hasMissingReferences ? 'export_success_with_missing_refs' : 'export_success'), error: false });
      } else if (file) {
        // Validate and preview first; nothing is written until the user accepts.
        const backup = await validateOfflineBackup(file, setFilename);
        const device = await previewDeviceRecords();
        setOperation(null);
        const created = new Date(backup.createdAt);
        const records = (heading: 'preview_backup' | 'preview_device', preview: RecordPreview) => [
          t(heading).replace('{count}', String(preview.total)),
          ...(preview.recent.length ? preview.recent.map(record => `・${formatDate(new Date(record.endTime))} ${record.name}`)
            : [`・${t('preview_no_records')}`]),
        ];
        const preview = [
          `${t('preview_file')}${file.name}`,
          `${t('preview_created')}${formatDate(created)} ${pad(created.getHours())}:${pad(created.getMinutes())}`,
          '', ...records('preview_backup', previewBackupRecords(backup)),
          '', ...records('preview_device', device),
          ...(backup.issues.length ? ['', t('preview_issues').replace('{count}', String(backup.issues.length))] : []),
        ].join('\n');
        if (!await confirm({ title: t('confirm_title'), message: `${preview}\n\n${t('confirm_message')}`,
          confirmText: t('confirm_import'), cancelText: t('cancel'), isDangerous: true })) return;
        setOperation('importing');
        setFilename('');
        const report = await applyOfflineBackup(backup);
        const partial = report.issues.length > 0;
        setImportIssues(report.issues);
        setFeedback({ text: t(partial ? 'import_partial' : 'import_success'), error: false, warning: partial });
        setOperation(null);
        const acknowledged = await confirm({
          title: t(partial ? 'import_partial_done' : 'import_done'),
          message: t(partial ? 'import_partial_reload' : 'import_reload_message') + (partial
            ? `\n\n${t('import_issues')} (${report.issues.length})\n${report.issues.slice(0, 3).map(issue =>
              issue.path.length > 72 ? `…${issue.path.slice(-71)}` : issue.path).join('\n')}${report.issues.length > 3 ? '\n…' : ''}` : ''),
          confirmText: t('confirm'), hideCancel: true,
        });
        // Recreate all in-memory preferences and query owners from the committed snapshot.
        try { if (acknowledged) window.location.reload(); }
        catch (error) { console.warn('Data imported, but page reload was blocked', error); }
      }
    } catch (error) {
      console.error('Offline backup failed', error);
      const key = error instanceof BackupError ? `error_${error.code}` as const
        : error instanceof Error && ['QuotaExceededError', 'SecurityError'].includes(error.name) ? 'error_storage' : 'error_unknown';
      const location = error instanceof BackupError && error.code === 'invalid' && error.message !== error.code
        ? ` ${t('error_location')}${error.message}` : '';
      setFeedback({ text: t(key) + location, error: true });
    } finally {
      setOperation(null);
      onBusyChange(false);
      busyRef.current = false;
    }
  };

  const actionClass = 'min-h-[44px] px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors';

  return <section aria-labelledby="settings-title" className="max-w-xl mx-auto space-y-6">
    <h2 id="settings-title" className="text-xl font-bold text-txt-primary">{t('settings')}</h2>
    <SettingsPreferences themeMode={themeMode} onSelectTheme={onSelectTheme} zoomLevel={zoomLevel}
      onZoomChange={onZoomChange} disabled={!!operation} />
    <SettingsGroup title={t('data_backup')} footer={t('backup_footer')}>
      <NavRow disabled={!!operation || isCloudSyncing} onClick={onOpenCloud} label={t('cloud_backup')}
        icon={isCloudSyncing ? <Loader2 size={20} className="text-txt-muted shrink-0 animate-spin" />
          : isCloudConnected ? <Cloud size={20} className="text-brand-primary shrink-0" /> : <CloudOff size={20} className="text-txt-muted shrink-0" />}
        status={t(isCloudSyncing ? 'cloud_syncing' : isCloudConnected ? 'cloud_connected' : 'cloud_disconnected')} />
      <div className="px-4 py-3 space-y-2">
        <p className="font-medium">{t('local_backup')}</p>
        <div className="grid grid-cols-2 gap-2 items-start">
          <div className="space-y-1.5">
            <button type="button" disabled={!!operation} onClick={() => void run('exporting')}
              className={`${actionClass} w-full bg-brand-primary-deep hover:bg-brand-primary text-txt-on-color`}>
              <Download size={18} className="shrink-0" />{t('export_all')}
            </button>
            <p className="text-xs text-txt-muted tabular-nums">{lastExport ? `${t('last_export')}${lastExport}` : t('never_exported')}</p>
          </div>
          {/* Restoring replaces everything: it uses the shared danger style and warns before tapping. */}
          <div className="space-y-1.5">
            <button type="button" disabled={!!operation} onClick={() => inputRef.current?.click()}
              aria-describedby="settings-restore-warning"
              className={`${actionClass} w-full border border-status-danger/30 bg-status-danger/10 hover:bg-status-danger/20 text-status-danger`}>
              <Upload size={18} className="shrink-0" />{t('import_all')}
            </button>
            <p id="settings-restore-warning" className="flex gap-1 text-xs font-medium text-status-danger">
              <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />{t('restore_warning')}
            </p>
          </div>
        </div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-status-danger text-sm' : feedback.warning ? 'text-status-warning text-sm' : 'text-status-success text-sm'}>{feedback.text}</p>}
        {!!importIssues.length && <details className="text-sm text-txt-secondary">
          <summary className="cursor-pointer text-status-warning">{t('import_issues')} ({importIssues.length})</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">{importIssues.map(issue =>
            `${issue.path} — ${t(`issue_${issue.reason}`)}${issue.detail ? ` (${issue.detail})` : ''}`).join('\n')}</pre>
        </details>}
      </div>
    </SettingsGroup>
    <SettingsGroup title={t('external_data')} footer={t('external_footer')}>
      <NavRow disabled={!!operation} onClick={onOpenGameCatalogImport} label={t('catalog_import')}
        icon={<Database size={20} className="text-txt-muted shrink-0" />} />
      <NavRow disabled={!!operation} onClick={onOpenBgStats} label={t('bgstats_transfer')}
        icon={<FileJson size={20} className="text-txt-muted shrink-0" />} />
    </SettingsGroup>
    <SettingsAbout />
    <input ref={inputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden"
      aria-label={t('import_all')} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void run('importing', file);
      }} />
    {operation && createPortal(<div className="fixed inset-0 z-[120] bg-modal-backdrop/90 flex items-center justify-center p-6"
      role="dialog" aria-modal="true" aria-label={t(operation)} tabIndex={-1} ref={progressRef}
      onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); }}>
      <div className="w-full max-w-sm bg-modal-bg border border-surface-border rounded-2xl p-6 space-y-3" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-txt-primary"><Loader2 size={20} className="animate-spin text-brand-primary" />{t(operation)}</div>
        <p className="text-sm text-txt-secondary break-all">{filename}</p>
      </div>
    </div>, document.body)}
  </section>;
}

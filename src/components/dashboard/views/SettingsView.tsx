import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Loader2, Cloud, CloudOff, ChevronRight, Database, FileJson } from 'lucide-react';
import type { AppTheme } from '../../../theme';
import { useSettingsTranslation } from '../../../i18n/settings';
import { SettingsPreferences } from './SettingsPreferences';
import { useConfirm } from '../../../hooks/useConfirm';
import { BackupError } from '../../../services/offlineBackup/errors';
import { exportOfflineBackup } from '../../../services/offlineBackup/export';
import { importOfflineBackup } from '../../../services/offlineBackup/import';
import type { OfflineBackupIssue } from '../../../types';

export function SettingsView({ themeMode, onToggleTheme, onBusyChange, zoomLevel, onZoomChange,
  isCloudConnected, isCloudSyncing, onOpenCloud, onOpenBgStats, onOpenBggImport }: {
  themeMode: AppTheme; onToggleTheme: () => void; onBusyChange: (busy: boolean) => void;
  zoomLevel: number; onZoomChange: (value: number) => void;
  isCloudConnected: boolean; isCloudSyncing: boolean; onOpenCloud: () => void;
  onOpenBgStats: () => void; onOpenBggImport: () => void;
}) {
  const t = useSettingsTranslation();
  const { confirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [operation, setOperation] = useState<'exporting' | 'importing' | null>(null);
  const [filename, setFilename] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean; warning?: boolean } | null>(null);
  const [importIssues, setImportIssues] = useState<OfflineBackupIssue[]>([]);
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
    if (file && !await confirm({ title: t('confirm_title'), message: t('confirm_message'),
      confirmText: t('confirm_import'), cancelText: t('cancel'), isDangerous: true })) {
      busyRef.current = false;
      return;
    }
    onBusyChange(true);
    setImportIssues([]);
    setOperation(mode);
    setFilename('');
    try {
      if (mode === 'exporting') {
        let hasMissingReferences = false;
        const blob = await exportOfflineBackup(setFilename, ids => { hasMissingReferences = ids.length > 0; });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const now = new Date();
        const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
        link.download = `BoardGameScorePad-${date}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setFeedback({ text: t(hasMissingReferences ? 'export_success_with_missing_refs' : 'export_success'), error: false });
      } else if (file) {
        const report = await importOfflineBackup(file, setFilename);
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

  return <section aria-labelledby="settings-title" className="max-w-xl mx-auto space-y-6">
    <h2 id="settings-title" className="text-xl font-bold text-txt-primary">{t('settings')}</h2>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-status-danger text-sm' : feedback.warning ? 'text-status-warning text-sm' : 'text-status-success text-sm'}>{feedback.text}</p>}
    {!!importIssues.length && <details className="text-sm text-txt-secondary">
      <summary className="cursor-pointer text-status-warning">{t('import_issues')} ({importIssues.length})</summary>
      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">{importIssues.map(issue =>
        `${issue.path} — ${t(`issue_${issue.reason}`)}${issue.detail ? ` (${issue.detail})` : ''}`).join('\n')}</pre>
    </details>}
    <SettingsPreferences themeMode={themeMode} onToggleTheme={onToggleTheme} zoomLevel={zoomLevel}
      onZoomChange={onZoomChange} disabled={!!operation} />
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-txt-secondary">{t('data_backup')}</h3>
      <button type="button" disabled={!!operation || isCloudSyncing} onClick={onOpenCloud}
        className="w-full min-h-[64px] p-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
        {isCloudSyncing ? <Loader2 size={22} className="text-txt-muted shrink-0 animate-spin" />
          : isCloudConnected ? <Cloud size={22} className="text-brand-primary shrink-0" /> : <CloudOff size={22} className="text-txt-muted shrink-0" />}
        <span className="flex-1 min-w-0"><span className="block font-medium">{t('cloud_backup')}</span>
          <span className="block text-sm text-txt-secondary mt-1">{t('cloud_description')}</span>
          <span className="block text-sm text-txt-muted mt-1">{t('cloud_shortcut')}</span></span>
        <span className="text-sm text-txt-secondary shrink-0">{t(isCloudSyncing ? 'cloud_syncing' : isCloudConnected ? 'cloud_connected' : 'cloud_disconnected')}</span>
        <ChevronRight size={16} className="text-txt-muted shrink-0" />
      </button>
      <button type="button" disabled={!!operation} onClick={() => void run('exporting')}
        className="w-full min-h-[64px] p-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
        <Download size={22} className="text-brand-primary shrink-0" />
        <span><span className="block font-medium">{t('export_all')}</span>
          <span className="block text-sm text-txt-secondary mt-1">{t('export_description')}</span></span>
      </button>
      <button type="button" disabled={!!operation} onClick={() => inputRef.current?.click()}
        className="w-full min-h-[64px] p-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
        <Upload size={22} className="text-txt-secondary shrink-0" />
        <span><span className="block font-medium">{t('import_all')}</span>
          <span className="block text-sm text-txt-secondary mt-1">{t('import_description')}</span></span>
      </button>
      <p className="text-sm text-txt-muted px-1">{t('builtin_notice')}</p>
    </div>
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-txt-secondary">{t('external_data')}</h3>
      <button type="button" disabled={!!operation} onClick={onOpenBggImport}
        className="w-full min-h-[64px] p-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
        <Database size={22} className="text-txt-muted shrink-0" />
        <span className="flex-1 min-w-0"><span className="block font-medium">{t('bgg_import')}</span>
          <span className="block text-sm text-txt-secondary mt-1">{t('bgg_description')}</span></span>
        <ChevronRight size={16} className="text-txt-muted shrink-0" />
      </button>
      <button type="button" disabled={!!operation} onClick={onOpenBgStats}
        className="w-full min-h-[64px] p-4 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover disabled:opacity-50 text-left transition-colors">
        <FileJson size={22} className="text-txt-muted shrink-0" />
        <span className="flex-1 min-w-0"><span className="block font-medium">{t('bgstats_transfer')}</span>
          <span className="block text-sm text-txt-secondary mt-1">{t('bgstats_description')}</span></span>
        <ChevronRight size={16} className="text-txt-muted shrink-0" />
      </button>
    </div>
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

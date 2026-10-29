import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Loader2, Palette, ChevronRight } from 'lucide-react';
import type { AppTheme } from '../../../theme';
import { APP_THEMES } from '../../../theme';
import { useSettingsTranslation } from '../../../i18n/settings';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useConfirm } from '../../../hooks/useConfirm';
import { BackupError } from '../../../services/offlineBackup/errors';
import { exportOfflineBackup } from '../../../services/offlineBackup/export';
import { importOfflineBackup } from '../../../services/offlineBackup/import';

export function SettingsView({ themeMode, onToggleTheme, onBusyChange }: {
  themeMode: AppTheme; onToggleTheme: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const t = useSettingsTranslation();
  const { t: tDash } = useDashboardTranslation();
  const { confirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [operation, setOperation] = useState<'exporting' | 'importing' | null>(null);
  const [filename, setFilename] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
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
        await importOfflineBackup(file, setFilename);
        setFeedback({ text: t('import_success'), error: false });
        // Recreate all in-memory preferences and query owners from the committed snapshot.
        try { window.location.reload(); }
        catch (error) { console.warn('Data imported, but page reload was blocked', error); }
      }
    } catch (error) {
      console.error('Offline backup failed', error);
      const key = error instanceof BackupError ? `error_${error.code}` as const
        : error instanceof Error && ['QuotaExceededError', 'SecurityError'].includes(error.name) ? 'error_storage' : 'error_unknown';
      setFeedback({ text: t(key), error: true });
    } finally {
      setOperation(null);
      onBusyChange(false);
      busyRef.current = false;
    }
  };

  return <section aria-labelledby="settings-title" className="max-w-xl mx-auto space-y-6">
    <h2 id="settings-title" className="text-xl font-bold text-txt-primary">{t('settings')}</h2>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-status-danger text-sm' : 'text-status-success text-sm'}>{feedback.text}</p>}
    <button type="button" disabled={!!operation} onClick={onToggleTheme}
      className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover transition-colors">
      <Palette size={20} className="text-txt-muted shrink-0" />
      <span className="flex-1 text-left">{t('appearance')}</span>
      <span className="text-sm text-txt-secondary">{tDash(APP_THEMES[themeMode].labelKey)}</span>
      <ChevronRight size={16} className="text-txt-muted" />
    </button>
    <div className="space-y-3">
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

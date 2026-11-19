import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Cloud, Download, HelpCircle, Loader2, Trash2, Trophy } from 'lucide-react';
import { db } from '../../../../db';
import { GameTemplate } from '../../../../types';
import { deleteTemplateFromCloud, fetchTemplateFromCloud } from '../../../../services/templateShareService';
import { googleAuth } from '../../../../services/cloud/googleAuth';
import { useCloudLibraryTranslation } from '../../../../i18n/cloud_library';
import { useOfficialBoardsTranslation } from '../../../../i18n/officialBoards';
import { useToast } from '../../../../hooks/useToast';
import { useConfirm } from '../../../../hooks/useConfirm';
import { generateId } from '../../../../utils/idGenerator';
import { DATA_LIMITS } from '../../../../dataLimits';
import { syncCatalog } from '../../../../features/official-boards/catalogSync';
import type { ShareCatalogEntry } from '../../../../features/official-boards/types';

interface ShareCatalogTabProps {
  userTemplates: GameTemplate[];
  onImport: (templates: GameTemplate[]) => void;
  onClose: () => void;
  /** Lets the modal block closing while an import or delete is running. */
  onBusyChange: (busy: boolean) => void;
}

/** Turn a downloaded shared payload into a new local template. */
const createLocalTemplate = (payload: any): GameTemplate => {
  const cleanColumns = Array.isArray(payload.columns)
    ? payload.columns.map((col: any) => ({ ...col, id: col.id || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT) }))
    : [];
  return { ...payload, id: generateId(), createdAt: Date.now(), updatedAt: Date.now(), columns: cleanColumns };
};

/**
 * User-shared scoreboards from the local share catalog. The list costs no D1
 * reads beyond catalog sync; a payload is downloaded only when importing it.
 */
const ShareCatalogTab: React.FC<ShareCatalogTabProps> = ({ userTemplates, onImport, onClose, onBusyChange }) => {
  const { t } = useCloudLibraryTranslation();
  const { t: tShare } = useOfficialBoardsTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const entries = useLiveQuery(() => db.shareCatalog.toArray(), []);
  const [syncing, setSyncing] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncFailed(false);
    try {
      await syncCatalog('share');
    } catch (error) {
      console.warn('[share catalog] sync failed', error);
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    sync();
  }, []);

  const busy = !!importingId || !!deletingId || !!bulkProgress;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const items = useMemo(() => [...(entries ?? [])].sort((a, b) => b.createdAt - a.createdAt), [entries]);
  const localNames = useMemo(() => new Set(userTemplates.map((ut) => ut.name.trim().toLowerCase())), [userTemplates]);
  const isImported = (name: string) => localNames.has(name.trim().toLowerCase());
  const importable = items.filter((item) => !isImported(item.name));

  /** Download one shared payload; null when it was removed from the cloud. */
  const download = async (item: ShareCatalogEntry): Promise<GameTemplate | null> => {
    const shared = await fetchTemplateFromCloud(item.id);
    if (!shared?.payload) {
      showToast({ message: tShare('share_import_missing', { name: item.name }), type: 'warning' });
      return null;
    }
    return createLocalTemplate({ ...(shared.payload as object), name: shared.name || item.name });
  };

  const handleImport = async (item: ShareCatalogEntry) => {
    if (isImported(item.name)) {
      showToast({ message: t('lib_import_already'), type: 'warning' });
      return;
    }
    setImportingId(item.id);
    try {
      const template = await download(item);
      if (!template) return;
      onImport([template]);
      showToast({ message: t('lib_import_success', { name: item.name }), type: 'success' });
    } catch (error) {
      showToast({ message: tShare('share_import_failed', { error: (error as Error)?.message || String(error) }), type: 'error' });
    } finally {
      setImportingId(null);
    }
  };

  const handleImportAll = async () => {
    if (importable.length === 0) {
      showToast({ message: t('lib_import_already'), type: 'warning' });
      return;
    }
    const imported: GameTemplate[] = [];
    setBulkProgress({ done: 0, total: importable.length });
    try {
      // Sequential so the per-device daily request limit and Worker load stay predictable.
      for (const item of importable) {
        const template = await download(item);
        if (template) imported.push(template);
        setBulkProgress({ done: imported.length, total: importable.length });
      }
    } catch (error) {
      showToast({ message: tShare('share_import_failed', { error: (error as Error)?.message || String(error) }), type: 'error' });
    } finally {
      setBulkProgress(null);
    }
    if (imported.length > 0) {
      onImport(imported);
      showToast({ message: t('lib_import_all_success', { count: imported.length }), type: 'success' });
      if (imported.length === importable.length) onClose();
    }
  };

  const handleDelete = async (item: ShareCatalogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: t('lib_delete_confirm_title'),
      message: t('lib_delete_confirm', { name: item.name }),
      confirmText: t('lib_btn_delete'),
      cancelText: t('lib_btn_cancel'),
      isDangerous: true,
    });
    if (!ok) return;
    setDeletingId(item.id);
    try {
      const token = googleAuth.token || (await googleAuth.signIn());
      if (!token) throw new Error('token_missing');
      await deleteTemplateFromCloud(item.id, token);
      // The Worker records the deletion in the catalog; drop it locally now as well.
      await db.shareCatalog.delete(item.id);
      showToast({ message: t('lib_delete_success', { name: item.name }), type: 'success' });
      syncCatalog('share', 'changes').catch(() => undefined);
    } catch (error) {
      showToast({ message: t('lib_delete_failed', { error: (error as Error)?.message || String(error) }), type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  if (entries === undefined || (syncing && items.length === 0)) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 size={36} className="text-brand-primary animate-spin" />
        <span className="text-sm font-semibold text-txt-secondary">{t('lib_loading')}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return syncFailed ? (
      <div className="min-h-full flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-12 h-12 rounded-full bg-status-danger/15 flex items-center justify-center text-status-danger mb-3">
          <HelpCircle size={24} />
        </div>
        <p className="text-sm text-status-danger font-semibold mb-2">{t('lib_error')}</p>
        <button onClick={sync} className="px-4 py-2 bg-brand-primary text-txt-on-color text-xs font-bold rounded-lg">
          {tShare('official_publish_retry')}
        </button>
      </div>
    ) : (
      <div className="min-h-full flex flex-col items-center justify-center py-16 text-txt-muted">
        <Cloud size={40} className="opacity-40 mb-2" />
        <span className="text-sm">{t('lib_no_data')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-[10px] text-txt-muted">
          {syncFailed ? tShare('share_list_stale') : tShare('share_count_weekly')}
        </span>
        {importable.length > 0 && (
          <button
            onClick={handleImportAll}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-txt-on-color bg-gradient-to-r from-brand-primary to-brand-secondary rounded-xl shadow-lg hover:filter hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            {bulkProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {bulkProgress ? tShare('share_import_progress', bulkProgress) : t('lib_btn_import_all')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const imported = isImported(item.name);
          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between p-3.5 rounded-xl border modal-bg-elevated transition-all relative overflow-hidden group ${
                imported ? 'border-status-success/30 bg-status-success/5 shadow-inner' : 'border-surface-border hover:border-brand-primary/50 shadow-sm'
              }`}
            >
              <div className="absolute top-2 right-2.5 flex items-center gap-2 text-[10px] font-mono scale-90">
                {item.downloadCount !== undefined && (
                  <div className="flex items-center gap-1 text-txt-muted opacity-80">
                    <Trophy size={10} className="text-status-warning shrink-0" />
                    <span>{t('lib_download_count', { count: item.downloadCount })}</span>
                  </div>
                )}
                <button
                  onClick={(e) => handleDelete(item, e)}
                  disabled={busy}
                  className="p-1 rounded bg-status-danger/10 hover:bg-status-danger text-status-danger hover:text-txt-on-color transition-colors disabled:opacity-50 flex items-center justify-center"
                  title={t('lib_btn_delete_tooltip')}
                >
                  {deletingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>

              <div className="mb-4 pr-16">
                <h4 className="font-bold text-sm text-txt-primary truncate group-hover:text-brand-primary transition-colors">{item.name}</h4>
                <p className="text-[11px] text-txt-muted mt-1 truncate">
                  {[item.bggName, item.lang, new Date(item.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                </p>
              </div>

              <div className="flex items-center justify-end mt-auto pt-2 border-t border-surface-border/60">
                {imported ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-status-success py-1.5 px-2">
                    <Check size={14} />
                    <span>{t('lib_btn_imported')}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleImport(item)}
                    disabled={busy}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-brand-primary/30 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary hover:text-txt-on-color transition-all active:scale-95 disabled:opacity-50"
                  >
                    {importingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    <span>{t('lib_btn_import')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShareCatalogTab;

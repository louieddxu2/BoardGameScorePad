import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, Download, Loader2, RotateCcw } from 'lucide-react';
import { db } from '../../../db';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import { useToast } from '../../../hooks/useToast';
import { useConfirm } from '../../../hooks/useConfirm';
import { OfficialApiError, fetchOfficialVersions, rollbackOfficialTemplate, updateOfficialSettings } from '../officialApi';
import { downloadOfficialVersion, localOfficialVersion } from '../officialBoards';
import { syncCatalog } from '../catalogSync';
import { loadOfficialBoards } from '../gameCatalog';
import type { OfficialCatalogEntry, OfficialVersionSummary } from '../types';

interface OfficialCatalogListProps {
  isAdmin: boolean;
}

const errorCode = (error: unknown) => (error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error));

/** Local catalog of official boards with cloud/local versions; admins can also manage each one. */
const OfficialCatalogList: React.FC<OfficialCatalogListProps> = ({ isAdmin }) => {
  const { t } = useOfficialBoardsTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<OfficialVersionSummary[] | null>(null);

  const catalog = useLiveQuery(loadOfficialBoards, []) ?? [];
  // Local version per official ID (bundled copy = 0, downloaded = its version).
  const localVersions = useLiveQuery(async () => {
    const builtins = await db.builtins.toArray();
    return new Map(builtins.map((b) => [b.id, localOfficialVersion(b)]));
  }, []);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return catalog
      .filter((e) => !query || e.name.toLowerCase().includes(query) || (e.enName || '').toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  }, [catalog, filter]);

  const withBusy = async (id: string, task: () => Promise<void>) => {
    setBusyId(id);
    try {
      await task();
    } catch (error) {
      showToast({ message: t('official_admin_failed', { error: errorCode(error) }), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const download = (entry: OfficialCatalogEntry) =>
    withBusy(entry.id, async () => {
      await downloadOfficialVersion(entry.id, entry.version, { install: true });
      showToast({ message: t('official_download_done', { name: entry.name, version: entry.version }), type: 'success' });
    });

  const toggleBundled = (entry: OfficialCatalogEntry) =>
    withBusy(entry.id, async () => {
      await updateOfficialSettings(entry.id, { bundled: !entry.bundled });
      await syncCatalog('games', 'changes');
    });

  const toggleHistory = (entry: OfficialCatalogEntry) =>
    withBusy(entry.id, async () => {
      if (historyFor === entry.id) {
        setHistoryFor(null);
        setHistory(null);
        return;
      }
      const result = await fetchOfficialVersions(entry.id);
      setHistoryFor(entry.id);
      setHistory(result.versions);
    });

  const restore = async (entry: OfficialCatalogEntry, version: number) => {
    const ok = await confirm({
      title: t('official_admin_restore'),
      message: t('official_admin_restore_confirm', { from: version, to: entry.version + 1 }),
    });
    if (!ok) return;
    await withBusy(entry.id, async () => {
      const result = await rollbackOfficialTemplate(entry.id, version, entry.version);
      await syncCatalog('games', 'changes');
      setHistory((await fetchOfficialVersions(entry.id)).versions);
      showToast({ message: t('official_admin_restored', { from: version, to: result.version }), type: 'success' });
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('official_list_title')}</div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('official_list_filter')}
          className="w-40 modal-bg-recessed border border-surface-border rounded-lg px-2 py-1 text-xs text-txt-primary outline-none"
        />
      </div>

      {visible.length === 0 && <p className="text-xs text-txt-muted py-4 text-center">{t('official_list_empty')}</p>}

      {visible.map((entry) => {
        const local = localVersions?.get(entry.id) ?? -1;
        const busy = busyId === entry.id;
        const canDownload = entry.version > 0 && entry.version > local;
        return (
          <div key={entry.id} className="modal-bg-elevated rounded-xl p-3 border border-surface-border space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-txt-primary truncate">{entry.name}</div>
                <div className="text-[11px] text-txt-muted flex flex-wrap gap-x-2">
                  <span>{entry.lang}</span>
                  <span>{entry.version > 0 ? t('official_cloud_version', { version: entry.version }) : t('official_cloud_bundled_only')}</span>
                  <span>
                    {local < 0 ? t('official_local_none') : local === 0 ? t('official_local_bundled') : t('official_local_version', { version: local })}
                  </span>
                  {entry.bundled && <span className="text-brand-primary">{t('official_badge_bundled')}</span>}
                </div>
              </div>
              {busy && <Loader2 size={16} className="animate-spin text-brand-primary shrink-0" />}
              {!busy && canDownload && (
                <button
                  onClick={() => download(entry)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 bg-brand-primary text-txt-on-color rounded-lg text-[11px] font-bold"
                >
                  <Download size={12} />
                  {local < 0 ? t('official_btn_download') : t('official_btn_update', { version: entry.version })}
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1.5 text-txt-secondary">
                  <input type="checkbox" checked={entry.bundled} disabled={busy} onChange={() => toggleBundled(entry)} />
                  {t('official_admin_bundled_toggle')}
                </label>
                <button onClick={() => toggleHistory(entry)} disabled={busy} className="flex items-center gap-1 text-txt-secondary">
                  {historyFor === entry.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {historyFor === entry.id ? t('official_admin_history_hide') : t('official_admin_history')}
                </button>
              </div>
            )}

            {isAdmin && historyFor === entry.id && history && (
              <div className="space-y-1 border-t border-surface-border pt-2">
                {history.map((v) => (
                  <div key={v.version} className="flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-txt-primary w-8">v{v.version}</span>
                    <span className="flex-1 text-txt-muted truncate">
                      {new Date(v.createdAt).toLocaleString()}
                      {v.restoredFrom !== undefined ? ` · ${t('official_admin_restored_from', { version: v.restoredFrom })}` : ''}
                    </span>
                    {v.version === entry.version ? (
                      <span className="text-brand-primary">{t('official_admin_current')}</span>
                    ) : (
                      <button onClick={() => restore(entry, v.version)} disabled={busy} className="flex items-center gap-1 text-txt-secondary">
                        <RotateCcw size={12} /> {t('official_admin_restore')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OfficialCatalogList;

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2, RefreshCw, DownloadCloud } from 'lucide-react';
import { db } from '../../../db';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import { syncCatalog, type CatalogSyncMode } from '../catalogSync';
import { OfficialApiError } from '../officialApi';
import type { CatalogKind, CatalogSyncState } from '../types';

const formatTime = (timestamp: number) => (timestamp ? new Date(timestamp).toLocaleString() : '');

/** Shows where each local catalog stands and lets the user force a check or a full reload. */
const CatalogSyncCard: React.FC = () => {
  const { t } = useOfficialBoardsTranslation();
  const states = useLiveQuery(() => db.catalogSync.toArray(), []) ?? [];
  const [running, setRunning] = useState<CatalogSyncMode | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const byKind = (kind: CatalogKind): CatalogSyncState | undefined => states.find((s) => s.kind === kind);

  const run = async (mode: CatalogSyncMode) => {
    setRunning(mode);
    setMessage(null);
    try {
      const results = await Promise.all((['official', 'share'] as CatalogKind[]).map((kind) => syncCatalog(kind, mode)));
      const changed = results.reduce((sum, r) => sum + r.changed, 0);
      setMessage({ error: false, text: changed > 0 ? t('official_sync_done', { count: changed }) : t('official_sync_up_to_date') });
    } catch (error) {
      const code = error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error);
      setMessage({ error: true, text: t('official_sync_failed', { error: code }) });
    } finally {
      setRunning(null);
    }
  };

  const renderState = (kind: CatalogKind, label: string) => {
    const state = byKind(kind);
    return (
      <div className="text-xs space-y-0.5">
        <div className="font-bold text-txt-primary">{label}</div>
        {state && state.checkedAt ? (
          <>
            <div className="text-txt-secondary">
              {t('official_sync_version', { version: state.throughVersion })} ·{' '}
              {t('official_sync_snapshot', { generation: state.generation, time: formatTime(state.snapshotAt) })}
            </div>
            <div className="text-txt-muted">{t('official_sync_checked', { time: formatTime(state.checkedAt) })}</div>
          </>
        ) : (
          <div className="text-txt-muted">{t('official_sync_never')}</div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-bg-elevated rounded-xl p-3 border border-surface-border space-y-3">
      <div className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('official_sync_title')}</div>
      <div className="grid grid-cols-2 gap-3">
        {renderState('official', t('official_sync_official'))}
        {renderState('share', t('official_sync_share'))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => run('changes')}
          disabled={!!running}
          className="flex items-center justify-center gap-1.5 py-2 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60"
        >
          {running === 'changes' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t('official_sync_check_now')}
        </button>
        <button
          onClick={() => run('snapshot')}
          disabled={!!running}
          className="flex items-center justify-center gap-1.5 py-2 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60"
        >
          {running === 'snapshot' ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
          {t('official_sync_reload')}
        </button>
      </div>
      {message && <p className={`text-xs ${message.error ? 'text-status-danger' : 'text-brand-primary'}`}>{message.text}</p>}
      <p className="text-[10px] text-txt-muted leading-relaxed">{t('official_sync_hint')}</p>
    </div>
  );
};

export default CatalogSyncCard;

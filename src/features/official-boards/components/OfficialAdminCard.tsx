import React, { useState } from 'react';
import { Hammer, Loader2 } from 'lucide-react';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import { OfficialApiError, rebuildCatalogSnapshot } from '../officialApi';
import { syncCatalog } from '../catalogSync';

const errorCode = (error: unknown) => (error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error));

/**
 * Catalog maintenance for the owner account. The weekly job rebuilds snapshots
 * on its own; this only lets the owner confirm a rebuild right away. An
 * unchanged catalog is not rebuilt, so pressing it again costs one row read.
 */
const OfficialAdminCard: React.FC = () => {
  const { t } = useOfficialBoardsTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const rebuild = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await rebuildCatalogSnapshot('official');
      // Only a new generation is worth downloading again.
      if (result.rebuilt) await syncCatalog('official', 'snapshot');
      setMessage({
        error: false,
        text: result.rebuilt ? t('official_admin_rebuild_yes', { generation: result.generation }) : t('official_admin_rebuild_no'),
      });
    } catch (error) {
      setMessage({ error: true, text: t('official_admin_failed', { error: errorCode(error) }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg-elevated rounded-xl p-3 border border-status-warning/30 space-y-2">
      <div className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('official_admin_title')}</div>
      <button
        onClick={rebuild}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 py-2 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />} {t('official_admin_rebuild')}
      </button>
      {message && <p className={`text-xs ${message.error ? 'text-status-danger' : 'text-brand-primary'}`}>{message.text}</p>}
    </div>
  );
};

export default OfficialAdminCard;

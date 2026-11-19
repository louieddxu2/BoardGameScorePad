import React, { useState } from 'react';
import { Hammer, Loader2, ListPlus } from 'lucide-react';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import { OfficialApiError, rebuildCatalogSnapshot, registerBundledBuiltins } from '../officialApi';
import { syncCatalog } from '../catalogSync';
import type { GameTemplate } from '../../../types';

const errorCode = (error: unknown) => (error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error));

/** Bundled built-ins with a BGG ID, as the Worker expects them for version 0 registration. */
const loadBundledRegistrations = async () => {
  const [{ DEFAULT_TEMPLATES }, { DEFAULT_TEMPLATES_EN }] = await Promise.all([
    import('../../../data/templates'),
    import('../../../data/templates-en'),
  ]);
  return ([...DEFAULT_TEMPLATES, ...DEFAULT_TEMPLATES_EN] as GameTemplate[])
    .filter((t) => t.id.startsWith('Built-in-') && t.bggId)
    .map((t) => ({ id: t.id, bggId: t.bggId!, lang: t.id.startsWith('Built-in-EN-') ? 'en' : 'zh-TW', name: t.name }));
};

/** Catalog maintenance tools for the owner account. */
const OfficialAdminCard: React.FC = () => {
  const { t } = useOfficialBoardsTranslation();
  const [busy, setBusy] = useState<'register' | 'rebuild' | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const run = async (kind: 'register' | 'rebuild', task: () => Promise<string>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage({ error: false, text: await task() });
    } catch (error) {
      setMessage({ error: true, text: t('official_admin_failed', { error: errorCode(error) }) });
    } finally {
      setBusy(null);
    }
  };

  const register = () =>
    run('register', async () => {
      const result = await registerBundledBuiltins(await loadBundledRegistrations());
      await syncCatalog('official', 'changes');
      return t('official_admin_register_done', { registered: result.registered, skipped: result.skipped });
    });

  const rebuild = () =>
    run('rebuild', async () => {
      const [official, share] = await Promise.all([rebuildCatalogSnapshot('official'), rebuildCatalogSnapshot('share')]);
      const describe = (r: { rebuilt: boolean; generation: number }) =>
        r.rebuilt ? t('official_admin_rebuild_yes', { generation: r.generation }) : t('official_admin_rebuild_no');
      // Download the new snapshots so the local state shows the rebuilt generation.
      await Promise.all([syncCatalog('official', 'snapshot'), syncCatalog('share', 'snapshot')]);
      return t('official_admin_rebuild_done', { official: describe(official), share: describe(share) });
    });

  const buttonClass = 'flex items-center justify-center gap-1.5 py-2 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60';
  const icon = (kind: typeof busy, Icon: typeof Hammer) =>
    busy === kind ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />;

  return (
    <div className="modal-bg-elevated rounded-xl p-3 border border-status-warning/30 space-y-2">
      <div className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('official_admin_title')}</div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={register} disabled={!!busy} className={buttonClass}>
          {icon('register', ListPlus)} {t('official_admin_register')}
        </button>
        <button onClick={rebuild} disabled={!!busy} className={buttonClass}>
          {icon('rebuild', Hammer)} {t('official_admin_rebuild')}
        </button>
      </div>
      {message && <p className={`text-xs ${message.error ? 'text-status-danger' : 'text-brand-primary'}`}>{message.text}</p>}
    </div>
  );
};

export default OfficialAdminCard;

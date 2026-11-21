import React, { useState } from 'react';
import { Hammer, ListPlus, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useCloudSession } from '../../../hooks/useCloudSession';
import { ensureCloudSession } from '../../../services/cloud/cloudSession';
import { db } from '../../../db';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import {
  OfficialApiError,
  rebuildCatalogSnapshot,
  registerBundledBuiltins,
  type BuiltinRegistration,
} from '../officialApi';
import { syncCatalog } from '../catalogSync';
import type { GameTemplate } from '../../../types';

// The Worker registers at most 8 per request (each also writes its game info).
const REGISTER_BATCH_SIZE = 8;

const errorCode = (error: unknown) => (error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error));

/** Bundled built-ins with a BGG ID that the synced official catalog does not list yet. */
const loadUnregisteredBuiltins = async (): Promise<BuiltinRegistration[]> => {
  const [{ DEFAULT_TEMPLATES }, { DEFAULT_TEMPLATES_EN }, catalog] = await Promise.all([
    import('../../../data/templates'),
    import('../../../data/templates-en'),
    db.officialCatalog.toArray(),
  ]);
  const listed = new Set(catalog.flatMap((e) => [e.id, `${e.bggId}|${e.lang}`]));
  return ([...DEFAULT_TEMPLATES, ...DEFAULT_TEMPLATES_EN] as GameTemplate[])
    .filter((t) => t.id.startsWith('Built-in-') && t.bggId)
    .map((t) => ({
      id: t.id,
      bggId: t.bggId!,
      lang: t.id.startsWith('Built-in-EN-') ? 'en' : 'zh-TW',
      name: t.name,
      payload: t,
    }))
    .filter((item) => !listed.has(item.id) && !listed.has(`${item.bggId}|${item.lang}`));
};

/**
 * Catalog maintenance for the owner account.
 * - Register stores bundled built-ins as version 0, sending only those the
 *   local catalog lacks, so pressing it again sends nothing.
 * - Rebuild publishes a new snapshot; an unchanged catalog is not rebuilt.
 */
const OfficialAdminCard: React.FC = () => {
  const { t } = useOfficialBoardsTranslation();
  const session = useCloudSession();
  const [busy, setBusy] = useState<'register' | 'rebuild' | 'signin' | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<string>) => {
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

  /** Rebuild the official snapshot and download it only when a new generation exists. */
  const rebuildOfficial = async () => {
    const result = await rebuildCatalogSnapshot('official');
    if (result.rebuilt) await syncCatalog('official', 'snapshot');
    return result;
  };

  const register = () =>
    run('register', async () => {
      await syncCatalog('official', 'changes');
      const items = await loadUnregisteredBuiltins();
      if (items.length === 0) return t('official_admin_register_none');
      let registered = 0;
      let skipped = 0;
      for (let i = 0; i < items.length; i += REGISTER_BATCH_SIZE) {
        const result = await registerBundledBuiltins(items.slice(i, i + REGISTER_BATCH_SIZE));
        registered += result.registered;
        skipped += result.skipped + result.rejected.length;
      }
      // New devices then read one snapshot instead of every registration as a change.
      if (registered > 0) await rebuildOfficial();
      else await syncCatalog('official', 'changes');
      return t('official_admin_register_done', { registered, skipped });
    });

  /** Sign this device in now (normally automatic after connecting Google Drive). */
  const signIn = () =>
    run('signin', async () => {
      const result = await ensureCloudSession({ interactive: true });
      return t('official_session_on', { date: new Date(result.expiresAt).toLocaleDateString() });
    });

  const rebuild = () =>
    run('rebuild', async () => {
      const result = await rebuildOfficial();
      return result.rebuilt ? t('official_admin_rebuild_yes', { generation: result.generation }) : t('official_admin_rebuild_no');
    });

  const buttonClass = 'flex items-center justify-center gap-1.5 py-2 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60';
  const icon = (kind: typeof busy, Icon: typeof Hammer) =>
    busy === kind ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />;

  return (
    <div className="modal-bg-elevated rounded-xl p-3 border border-status-warning/30 space-y-2">
      <div className="text-xs font-bold text-txt-muted uppercase tracking-wider">{t('official_admin_title')}</div>
      {session.expiresAt ? (
        <p className="flex items-center gap-1.5 text-xs text-brand-primary">
          <ShieldCheck size={14} className="shrink-0" />
          {t('official_session_on', { date: new Date(session.expiresAt).toLocaleDateString() })}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs text-txt-muted">{t('official_session_off')}</p>
          <button onClick={signIn} disabled={!!busy} className="flex items-center gap-1 px-2.5 py-1.5 btn-modal-secondary rounded-lg text-xs font-bold disabled:opacity-60 flex-none">
            {icon('signin', LogIn)} {t('official_session_sign_in')}
          </button>
        </div>
      )}
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

import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronRight, Loader2, RotateCcw, Send } from 'lucide-react';
import { db } from '../../../db';
import type { GameTemplate } from '../../../types';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import { useAppTranslation } from '../../../i18n/app';
import { OfficialApiError, fetchPublishTarget, publishOfficialTemplate } from '../officialApi';
import { syncCatalog } from '../catalogSync';
import { toOfficialGameInfo } from '../officialGameInfo';
import type { OfficialPublishTarget } from '../types';

interface OfficialPublishSectionProps {
  template: GameTemplate;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
}

type Lang = 'zh-TW' | 'en';
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;
type ColumnDiff = { added: number; removed: number; renamed: number };

const UNFINISHED_COLUMN_NAME = new RegExp('^(\\u9805\\u76ee|Item)\\s*\\d+$', 'i');

const LOCAL_ONLY_KEYS =['createdAt', 'updatedAt', 'lastSyncedAt', 'imageId', 'hasImage', 'cloudImageId', 'sourceTemplateId', 'lastPlayerCount', 'officialVersion'] as const;

const defaultLang = (template: GameTemplate, appLang: string): Lang => {
  const source = template.sourceTemplateId || template.id;
  if (source.startsWith('Built-in-EN-')) return 'en';
  if (source.startsWith('Built-in-')) return 'zh-TW';
  return appLang.startsWith('en') ? 'en' : 'zh-TW';
};

/** The bundled built-in this draft replaces, when it comes from one with the same BGG ID and language. */
const findBundledBuiltin = async (template: GameTemplate, bggId: string, lang: Lang): Promise<GameTemplate | null> => {
  const source = template.sourceTemplateId || template.id;
  if (!source.startsWith('Built-in-') || source.startsWith('Built-in-EN-') !== (lang === 'en')) return null;
  const builtin = await db.builtins.get(source);
  return builtin?.bggId?.trim() === bggId ? builtin : null;
};

const diffColumns = (base: { id: string; name: string }[], draft: { id: string; name: string }[]): ColumnDiff => {
  const baseNames = new Map(base.map((c) => [c.id, c.name]));
  const draftIds = new Set(draft.map((c) => c.id));
  return {
    added: draft.filter((c) => !baseNames.has(c.id)).length,
    removed: base.filter((c) => !draftIds.has(c.id)).length,
    renamed: draft.filter((c) => baseNames.has(c.id) && baseNames.get(c.id) !== c.name).length,
  };
};

const errorText = (error: unknown) => (error instanceof OfficialApiError ? error.code : String((error as Error)?.message || error));

/** Admin-only: publish this scoreboard as the official one for its BGG ID and language. */
const OfficialPublishSection: React.FC<OfficialPublishSectionProps> = ({ template, onGetFullTemplate }) => {
  const { t } = useOfficialBoardsTranslation();
  const { t: tApp } = useAppTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => defaultLang(template, tApp('app_lang_code') || 'zh-TW'));
  const [target, setTarget] = useState<OfficialPublishTarget | null>(null);
  const [draft, setDraft] = useState<GameTemplate | null>(null);
  const [diff, setDiff] = useState<ColumnDiff | null>(null);
  const [enName, setEnName] = useState('');
  const [bundled, setBundled] = useState(false);
  const [builtin, setBuiltin] = useState<GameTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const bggId = template.bggId?.trim();

  const loadTarget = async (keepNotice = false) => {
    if (!bggId) return;
    setLoading(true);
    if (!keepNotice) setNotice(null);
    try {
      const full = template.columns?.length ? template : (await onGetFullTemplate(template.id)) ?? template;
      const next = await fetchPublishTarget(bggId, lang);
      // A built-in is not in the cloud until its first publish; version 0 is the app's own copy.
      const bundledSource = next.exists ? null : await findBundledBuiltin(full, bggId, lang);
      const baseColumns = next.latestPayload?.columns
        ?? (next.exists && next.id ? (await db.builtins.get(next.id))?.columns : bundledSource?.columns);
      const bgg = await db.bggGames.get(bggId);
      setDraft(full);
      setTarget(next);
      setDiff(baseColumns ? diffColumns(baseColumns, full.columns || []) : null);
      setBuiltin(bundledSource);
      setBundled(next.exists ? !!next.bundled : !!bundledSource);
      setEnName(next.enName || bgg?.name || '');
    } catch (error) {
      setTarget(null);
      setNotice({ tone: 'error', text: t('official_publish_failed', { error: errorText(error) }) });
    } finally {
      setLoading(false);
    }
  };

  // Reload only when what defines the target changes; translation and callback
  // props get new identities on every render.
  const loadTargetRef = useRef(loadTarget);
  loadTargetRef.current = loadTarget;
  useEffect(() => {
    if (isOpen) loadTargetRef.current();
  }, [isOpen, lang, bggId]);

  const handlePublish = async () => {
    if (!bggId || !target || !draft) return;
    const columns = draft.columns || [];
    // Same unfinished-board check as cloud sharing (default "Item N" column names in either language).
    if (columns.length === 0 || columns.some((c) => UNFINISHED_COLUMN_NAME.test(c.name))) {
      setNotice({ tone: 'error', text: t('official_publish_failed', { error: 'unfinished' }) });
      return;
    }
    setPublishing(true);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = { ...draft };
      for (const key of LOCAL_ONLY_KEYS) delete payload[key];
      // Aliases and other BGG data on this device go along, so nothing has to be typed in.
      const localGame = await db.bggGames.get(bggId);
      const result = await publishOfficialTemplate({
        bggId,
        lang,
        name: draft.name,
        enName: enName.trim() || undefined,
        payload,
        bundled,
        gameInfo: localGame ? toOfficialGameInfo(localGame) : undefined,
        builtinId: builtin?.id,
        expectedVersion: target.exists ? target.version ?? 0 : 0,
      });
      // Pull the change into the local catalog right away so the result is visible here.
      await syncCatalog('official', 'changes').catch(() => undefined);
      await loadTarget();
      setNotice(
        result.unchanged
          ? { tone: 'info', text: t('official_publish_unchanged', { version: result.version }) }
          : { tone: 'success', text: t('official_publish_done', { name: draft.name, version: result.version }) }
      );
    } catch (error) {
      if (error instanceof OfficialApiError && error.code === 'version_conflict') {
        await loadTarget(true);
        setNotice({ tone: 'error', text: t('official_publish_conflict') });
      } else {
        setNotice({ tone: 'error', text: t('official_publish_failed', { error: errorText(error) }) });
      }
    } finally {
      setPublishing(false);
    }
  };

  const nextVersion = target?.nextVersion ?? 1;
  const noticeClass = notice?.tone === 'error' ? 'text-status-danger' : notice?.tone === 'success' ? 'text-brand-primary' : 'text-txt-secondary';

  return (
    <div className="space-y-3 mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs font-bold text-txt-muted uppercase tracking-wider flex items-center gap-2"
      >
        <BadgeCheck size={14} />
        <span className="flex-1 text-left">{t('official_publish_title')}</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="modal-bg-elevated rounded-xl p-4 border border-status-warning/30 space-y-3">
          {!bggId ? (
            <p className="text-xs text-status-warning">{t('official_publish_need_bgg')}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-txt-muted shrink-0">{t('official_publish_lang')}</span>
                {(['zh-TW', 'en'] as Lang[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    disabled={publishing}
                    className={`px-2.5 py-1 rounded-lg font-bold ${lang === code ? 'bg-brand-primary text-txt-on-color' : 'btn-modal-secondary'}`}
                  >
                    {code === 'en' ? t('official_publish_lang_en') : t('official_publish_lang_zh')}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-txt-secondary">
                  <Loader2 size={14} className="animate-spin" /> {t('official_publish_loading')}
                </div>
              )}

              {!loading && target && (
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-txt-primary">
                    {target.exists || builtin
                      ? t('official_publish_update', { name: target.name || builtin?.name || '', from: target.version ?? 0, to: nextVersion })
                      : t('official_publish_create')}
                  </p>
                  {(target.exists ? target.version === 0 : !!builtin) && <p className="text-txt-muted">{t('official_publish_bundled_v0')}</p>}
                  {diff && (
                    <p className="text-txt-secondary">
                      {diff.added + diff.removed + diff.renamed === 0
                        ? t('official_publish_no_column_changes')
                        : t('official_publish_changes', diff)}
                    </p>
                  )}
                  <label className="block space-y-1">
                    <span className="text-txt-muted">{t('official_publish_en_name')}</span>
                    <input
                      value={enName}
                      onChange={(e) => setEnName(e.target.value)}
                      disabled={publishing}
                      className="w-full modal-bg-recessed border border-surface-border rounded-lg px-3 py-2 text-txt-primary outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-txt-secondary">
                    <input type="checkbox" checked={bundled} onChange={(e) => setBundled(e.target.checked)} disabled={publishing} />
                    {t('official_publish_bundled')}
                  </label>
                  {(template.hasImage || template.imageId) && <p className="text-txt-muted italic">{t('official_publish_image_note')}</p>}
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary hover:filter hover:brightness-110 text-txt-on-color rounded-xl font-bold active:scale-95 transition-all disabled:opacity-60"
                  >
                    {publishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {publishing ? t('official_publish_running') : t('official_publish_btn', { version: nextVersion })}
                  </button>
                </div>
              )}

              {!loading && !target && (
                <button onClick={() => loadTarget()} className="w-full flex items-center justify-center gap-2 py-2 btn-modal-secondary rounded-lg text-xs font-bold">
                  <RotateCcw size={14} /> {t('official_publish_retry')}
                </button>
              )}
            </>
          )}
          {notice && <p className={`text-xs ${noticeClass}`}>{notice.text}</p>}
        </div>
      )}
    </div>
  );
};

export default OfficialPublishSection;

import React, { useEffect, useState } from 'react';
import { RELEASE_NOTES, type ReleaseNote, type ReleaseNoteKind } from '../../../data/releaseNotes';
import { useTranslation } from '../../../i18n';
import { useSettingsTranslation } from '../../../i18n/settings';

const CACHE_PREFIX = 'boardgame-scorepad-cache-';

/** The service worker keeps one dated cache, so its name identifies the installed release. */
function useInstalledRevision() {
  const [revision, setRevision] = useState('');
  useEffect(() => {
    let active = true;
    if (typeof caches === 'undefined') return;
    caches.keys().then(names => {
      const latest = names.filter(name => name.startsWith(CACHE_PREFIX)).sort().pop();
      if (active && latest) setRevision(latest.slice(CACHE_PREFIX.length));
    }).catch(() => { /* Without cache access the line simply stays hidden. */ });
    return () => { active = false; };
  }, []);
  return revision;
}

const KINDS: { kind: ReleaseNoteKind; className: string }[] = [
  { kind: 'new', className: 'text-brand-primary' },
  { kind: 'improved', className: 'text-txt-secondary' },
  { kind: 'fixed', className: 'text-status-success' },
];

// Items are grouped under one label per kind so phone-width lines wrap across the full width.
function ReleaseItems({ note }: { note: ReleaseNote }) {
  const t = useSettingsTranslation();
  const { language } = useTranslation();
  return <div className="mt-1.5 space-y-1.5 text-sm text-txt-primary">
    {KINDS.map(({ kind, className }) => {
      const items = note.items.filter(item => item.kind === kind);
      if (!items.length) return null;
      return <div key={kind}>
        <p className={`text-xs font-medium ${className}`}>{t(`release_${kind}`)}</p>
        <ul className="list-disc pl-4 space-y-0.5 marker:text-txt-muted">
          {items.map((item, index) => <li key={index}>{language === 'zh-TW' ? item.zh : item.en}</li>)}
        </ul>
      </div>;
    })}
  </div>;
}

function ReleaseHeading({ note, className }: { note: ReleaseNote; className: string }) {
  return <p className={`tabular-nums ${className}`}>
    {note.date}{note.version && <span className="ml-2 text-txt-muted">{note.version}</span>}
  </p>;
}

export function SettingsAbout() {
  const t = useSettingsTranslation();
  const revision = useInstalledRevision();
  const [latest, ...earlier] = RELEASE_NOTES;
  if (!latest) return null;

  return <div className="space-y-2">
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h3 className="text-sm font-medium text-txt-secondary">{t('about')}</h3>
      {revision && <p className="text-xs text-txt-muted tabular-nums">{t('version')} {revision}</p>}
    </div>
    <div className="px-4 py-3 rounded-xl border border-surface-border bg-surface-bg">
      <p className="font-medium text-txt-primary">{t('latest_update')}<span className="ml-2 text-sm text-txt-secondary tabular-nums">{latest.date}</span></p>
      <ReleaseItems note={latest} />
      {!!earlier.length && <details className="mt-3 border-t border-surface-border pt-1">
        <summary className="cursor-pointer min-h-[44px] flex items-center text-sm text-txt-secondary">{t('earlier_updates')}</summary>
        <div className="space-y-4 mt-1">
          {earlier.map(note => <section key={note.date} aria-label={note.date}>
            <ReleaseHeading note={note} className="text-sm font-medium text-txt-secondary" />
            <ReleaseItems note={note} />
          </section>)}
        </div>
      </details>}
    </div>
  </div>;
}

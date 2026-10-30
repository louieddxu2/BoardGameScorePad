import React from 'react';
import { RELEASE_NOTES, type ReleaseNote, type ReleaseNoteKind } from '../../../data/releaseNotes';
import { useTranslation } from '../../../i18n';
import { useSettingsTranslation } from '../../../i18n/settings';

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
  const [latest, ...earlier] = RELEASE_NOTES;
  if (!latest) return null;

  return <div className="space-y-3">
    <h3 className="text-sm font-medium text-txt-secondary">{t('about')}</h3>
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

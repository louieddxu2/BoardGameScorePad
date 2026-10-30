import React from 'react';
import { RELEASE_NOTES, type ReleaseNote } from '../../../data/releaseNotes';
import { useTranslation } from '../../../i18n';
import { useSettingsTranslation } from '../../../i18n/settings';

const KIND_CLASS = {
  new: 'text-brand-primary',
  improved: 'text-txt-secondary',
  fixed: 'text-status-success',
} as const;

function ReleaseItems({ note }: { note: ReleaseNote }) {
  const t = useSettingsTranslation();
  const { language } = useTranslation();
  return <ul className="mt-2 space-y-1.5 text-sm text-txt-primary">
    {note.items.map((item, index) => <li key={index} className="flex gap-2">
      <span className={`shrink-0 font-medium ${KIND_CLASS[item.kind]}`}>{t(`release_${item.kind}`)}</span>
      <span className="min-w-0">{language === 'zh-TW' ? item.zh : item.en}</span>
    </li>)}
  </ul>;
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
      {!!earlier.length && <details className="mt-3 border-t border-surface-border pt-3">
        <summary className="cursor-pointer min-h-[44px] flex items-center text-sm text-txt-secondary">{t('earlier_updates')}</summary>
        <div className="space-y-4 mt-1">
          {earlier.map(note => <section key={note.date} aria-label={note.date}>
            <p className="text-sm font-medium text-txt-secondary tabular-nums">{note.date}</p>
            <ReleaseItems note={note} />
          </section>)}
        </div>
      </details>}
    </div>
  </div>;
}

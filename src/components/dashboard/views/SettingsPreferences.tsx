import React from 'react';
import { APP_THEMES, APP_THEME_ORDER, type AppTheme } from '../../../theme';
import { useTranslation, type Language } from '../../../i18n';
import { useSettingsTranslation } from '../../../i18n/settings';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { MOBILE_ZOOM_MIN, MOBILE_ZOOM_MAX } from '../../../hooks/useMobileZoom';
import { Segmented, SettingsGroup } from './SettingsRows';

interface SettingsPreferencesProps {
  themeMode: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  zoomLevel: number;
  onZoomChange: (value: number) => void;
  disabled: boolean;
}

export function SettingsPreferences({ themeMode, onSelectTheme, zoomLevel, onZoomChange, disabled }: SettingsPreferencesProps) {
  const t = useSettingsTranslation();
  const { t: tDash } = useDashboardTranslation();
  const { language, setLanguage } = useTranslation();
  const percentage = Math.round(zoomLevel * 100);

  return <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
    <SettingsGroup title={t('interface_settings')} footer={t('interface_shortcuts')}>
      <div className="px-4 py-3 space-y-2">
        <p className="font-medium">{t('appearance')}</p>
        <Segmented label={t('appearance')} value={themeMode} onChange={onSelectTheme}
          options={APP_THEME_ORDER.map(theme => ({ value: theme, label: tDash(APP_THEMES[theme].labelKey) }))} />
      </div>
      <div className="px-4 py-3 flex items-center gap-3">
        <p className="flex-1 font-medium">{t('language')}</p>
        <Segmented<Language> label={t('language')} value={language} onChange={setLanguage} className="shrink-0"
          options={[{ value: 'zh-TW', label: t('language_zh_tw') }, { value: 'en', label: t('language_en') }]} />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <label htmlFor="settings-zoom" className="flex-1 font-medium">{t('interface_size')}</label>
          <output htmlFor="settings-zoom" className="text-sm text-txt-secondary tabular-nums">{percentage}%</output>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <input id="settings-zoom" type="range" min={MOBILE_ZOOM_MIN * 100} max={MOBILE_ZOOM_MAX * 100}
            step={1} value={percentage} onChange={event => onZoomChange(Number(event.target.value) / 100)}
            aria-valuetext={`${percentage}%`}
            // The native slider owns horizontal dragging; global pinch capture still runs.
            onTouchStart={event => event.stopPropagation()}
            className="min-w-0 flex-1 h-11 accent-brand-primary" />
          {percentage !== 100 && <button type="button" onClick={() => onZoomChange(1)}
            className="min-h-[40px] px-3 rounded-lg border border-surface-border bg-surface-alt hover:bg-surface-hover text-sm text-txt-secondary">
            {t('reset_size')}
          </button>}
        </div>
      </div>
    </SettingsGroup>
  </fieldset>;
}

import React from 'react';
import { Languages, Palette, ChevronRight, Scaling } from 'lucide-react';
import { APP_THEMES, type AppTheme } from '../../../theme';
import { useTranslation, type Language } from '../../../i18n';
import { useSettingsTranslation } from '../../../i18n/settings';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { MOBILE_ZOOM_MIN, MOBILE_ZOOM_MAX } from '../../../hooks/useMobileZoom';

interface SettingsPreferencesProps {
  themeMode: AppTheme;
  onToggleTheme: () => void;
  zoomLevel: number;
  onZoomChange: (value: number) => void;
  disabled: boolean;
}

export function SettingsPreferences({ themeMode, onToggleTheme, zoomLevel, onZoomChange, disabled }: SettingsPreferencesProps) {
  const t = useSettingsTranslation();
  const { t: tDash } = useDashboardTranslation();
  const { language, setLanguage } = useTranslation();
  const percentage = Math.round(zoomLevel * 100);

  return <fieldset disabled={disabled} className="min-w-0 space-y-3 disabled:opacity-50">
    <legend className="text-sm font-medium text-txt-secondary mb-3">{t('interface_settings')}</legend>
    <button type="button" onClick={onToggleTheme}
      className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary hover:bg-surface-hover text-left transition-colors">
      <Palette size={20} className="text-txt-muted shrink-0" />
      <span className="flex-1 min-w-0"><span className="block font-medium">{t('appearance')}</span>
        <span className="block text-sm text-txt-secondary mt-1">{t('appearance_shortcut')}</span></span>
      <span className="text-sm text-txt-secondary shrink-0">{tDash(APP_THEMES[themeMode].labelKey)}</span>
      <ChevronRight size={16} className="text-txt-muted shrink-0" />
    </button>
    <div className="px-4 py-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary">
      <div className="flex items-center gap-3">
        <Scaling size={20} className="text-txt-muted shrink-0" />
        <label htmlFor="settings-zoom" className="flex-1 font-medium">{t('interface_size')}</label>
        <output htmlFor="settings-zoom" className="text-sm text-txt-secondary tabular-nums">{percentage}%</output>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <input id="settings-zoom" type="range" min={MOBILE_ZOOM_MIN * 100} max={MOBILE_ZOOM_MAX * 100}
          step={1} value={percentage} onChange={event => onZoomChange(Number(event.target.value) / 100)}
          aria-valuetext={`${percentage}%`} aria-describedby="settings-zoom-hint"
          // The native slider owns horizontal dragging; global pinch capture still runs.
          onTouchStart={event => event.stopPropagation()}
          className="min-w-0 flex-1 h-11 accent-brand-primary" />
        <button type="button" onClick={() => onZoomChange(1)}
          className="min-h-[44px] px-3 rounded-lg border border-surface-border bg-surface-alt hover:bg-surface-hover text-sm text-txt-secondary">
          {t('reset_size')}
        </button>
      </div>
      <p id="settings-zoom-hint" className="text-sm text-txt-secondary">{t('size_shortcut')}</p>
    </div>
    <div className="px-4 py-3 rounded-xl border border-surface-border bg-surface-bg text-txt-primary">
      <div className="flex items-center gap-3">
        <Languages size={20} className="text-txt-muted shrink-0" />
        <label htmlFor="settings-language" className="flex-1 font-medium">{t('language')}</label>
        <select id="settings-language" value={language} onChange={event => setLanguage(event.target.value as Language)}
          className="min-w-0 max-w-[60%] min-h-[44px] rounded-lg border border-surface-border bg-surface-alt text-txt-primary px-2 text-sm">
          <option value="zh-TW">{t('language_zh_tw')}</option>
          <option value="en">{t('language_en')}</option>
        </select>
      </div>
      <p className="text-sm text-txt-secondary mt-1">{t('language_shortcut')}</p>
    </div>
  </fieldset>;
}

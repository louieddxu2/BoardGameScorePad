
import { useTranslation } from '../i18n';

export const dashboardTranslations = {
  'zh-TW': {
    // Search Empty State
    dash_create_btn: "建立計分板 \"{name}\"",
    dash_quick_play_btn: "建立並計分 \"{name}\"",
    
    // Quick Action Feedback
    dash_creating: "正在建立...",
  },
  'en': {
    // Search Empty State
    dash_create_btn: "Create Scoreboard \"{name}\"",
    dash_quick_play_btn: "Create & Score \"{name}\"",

    // Quick Action Feedback
    dash_creating: "Creating...",
  }
};

export type DashboardTranslationKey = keyof typeof dashboardTranslations['zh-TW'];

export const useDashboardTranslation = () => {
  const { language } = useTranslation();
  const t = (key: DashboardTranslationKey, params?: Record<string, string | number>) => {
    const dict = dashboardTranslations[language] || dashboardTranslations['zh-TW'];
    let text = dict[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
  return { t, language };
};


import { useTranslation } from '../i18n';

export const appTranslations = {
  'zh-TW': {
    msg_press_again_to_exit: "再按一次即可離開",
  },
  'en': {
    msg_press_again_to_exit: "Press back again to exit",
  }
};

export type AppTranslationKey = keyof typeof appTranslations['zh-TW'];

export const useAppTranslation = () => {
  const { language } = useTranslation();
  const t = (key: AppTranslationKey) => {
    const dict = appTranslations[language] || appTranslations['zh-TW'];
    return dict[key] || key;
  };
  return { t };
};

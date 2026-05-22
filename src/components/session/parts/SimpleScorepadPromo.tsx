import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface SimpleScorepadPromoProps {
  isInitialSimpleScorepad: boolean;
  leftColWidth: number;
  onOpenOnlineSearch?: () => void;
}

const SimpleScorepadPromo: React.FC<SimpleScorepadPromoProps> = ({
  isInitialSimpleScorepad,
  leftColWidth,
  onOpenOnlineSearch,
}) => {
  const { t } = useSessionTranslation();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (!isInitialSimpleScorepad) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isInitialSimpleScorepad]);

  if (!isInitialSimpleScorepad) return null;

  return (
    <>
      <div className="mx-6 my-4 z-10 flex flex-col items-center p-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm shadow-sm relative animate-fade-in">
        {/* Pointer to the '+' button in GridFooter */}
        <div className="flex items-start gap-1.5 text-txt-secondary text-xs mb-3 text-left w-full">
          <ArrowUp className="w-4 h-4 text-brand-primary shrink-0 animate-bounce mt-0.5" />
          <span className="leading-relaxed font-medium">
            {t('session_simple_promo_arrow_hint')}
          </span>
        </div>

        {/* Combined exploration/AI scan button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isOnline) {
              onOpenOnlineSearch?.();
            }
          }}
          disabled={!isOnline}
          className={`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-xs font-semibold text-white transition-all shadow-md shadow-brand-primary/10 flex items-center justify-center gap-2 ${
            !isOnline 
              ? 'opacity-40 cursor-not-allowed filter grayscale shadow-none' 
              : 'hover:opacity-95 active:scale-[0.98]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isOnline ? t('session_simple_promo_btn') : t('session_simple_promo_btn_offline')}</span>
        </button>
      </div>

      {/* 右側玩家區域置中總分輸入提示 */}
      <div 
        className="w-full flex justify-center items-center mt-1 mb-3 animate-fade-in text-txt-muted text-xs gap-1.5"
        style={{ paddingLeft: `${leftColWidth}px` }}
      >
        <ArrowDown className="w-3.5 h-3.5 text-brand-primary shrink-0 animate-bounce" />
        <span className="font-semibold text-[11px] tracking-wide">
          {t('session_simple_promo_totals_hint')}
        </span>
      </div>
    </>
  );
};

export default SimpleScorepadPromo;

import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface SimpleScorepadPromoProps {
  isInitialSimpleScorepad: boolean;
  leftColWidth: number;
  onOpenOnlineSearch?: () => void;
  aiStatus?: string;
  elapsedTime?: number;
}

const SimpleScorepadPromo: React.FC<SimpleScorepadPromoProps> = ({
  isInitialSimpleScorepad,
  leftColWidth,
  onOpenOnlineSearch,
  aiStatus,
  elapsedTime,
}) => {
  const { t } = useSessionTranslation();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const isGenerating = aiStatus === 'compressing' || aiStatus === 'generating';

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
      <div className="mx-6 my-4 z-10 flex flex-col items-center p-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm shadow-sm relative animate-fade-in overflow-hidden select-none">
        {/* Stream decorative line for AI generating */}
        {isGenerating && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-pulse" />
        )}

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
            if (isOnline && !isGenerating) {
              onOpenOnlineSearch?.();
            }
          }}
          disabled={!isOnline || isGenerating}
          className={`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r text-xs font-semibold text-white transition-all shadow-md flex items-center justify-center gap-2 ${
            isGenerating
              ? 'from-brand-primary/10 via-brand-secondary/10 to-brand-primary/10 animate-pulse border border-brand-primary/30 text-brand-primary shadow-none cursor-wait'
              : !isOnline 
                ? 'from-brand-primary to-brand-secondary opacity-40 cursor-not-allowed filter grayscale shadow-none' 
                : 'from-brand-primary to-brand-secondary hover:opacity-95 active:scale-[0.98] shadow-brand-primary/10'
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping" />
              <span>{t('session_ai_generating_with_timer').replace('{seconds}', (elapsedTime || 0).toString())}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{isOnline ? t('session_simple_promo_btn') : t('session_simple_promo_btn_offline')}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default SimpleScorepadPromo;

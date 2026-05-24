import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface SimpleScorepadPromoProps {
  isInitialSimpleScorepad: boolean;
  leftColWidth: number;
  onOpenOnlineSearch?: () => void;
  aiStatus?: string;
  elapsedTime?: number;
  zoomLevel?: number;
}

const SimpleScorepadPromo: React.FC<SimpleScorepadPromoProps> = ({
  isInitialSimpleScorepad,
  leftColWidth,
  onOpenOnlineSearch,
  aiStatus,
  elapsedTime,
  zoomLevel = 1,
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
    <div className="w-full flex items-center gap-2 py-1 select-none animate-in fade-in duration-300">
      
      {/* 標籤框 1：手動新增指引 (置左，寬度與 + 號方格完全一致，左右並列，字體放大) */}
      <div 
        className="p-1 rounded-xl border border-surface-border bg-surface-bg-alt/50 backdrop-blur-sm text-txt-secondary flex flex-row items-center justify-center gap-1 shadow-sm shrink-0 text-left break-words leading-tight box-border overflow-hidden"
        style={{ 
          width: `${leftColWidth}px`,
          fontSize: `${11 * zoomLevel}px`
        }}
      >
        <ArrowUp 
          className="text-brand-primary shrink-0 animate-bounce" 
          style={{
            width: `${14 * zoomLevel}px`,
            height: `${14 * zoomLevel}px`
          }}
        />
        <span className="font-black tracking-tighter">
          {t('session_simple_promo_arrow_hint')}
        </span>
      </div>

      {/* 標籤框 2：AI 智慧生成與探索窄卡片 */}
      <div className="flex-1 p-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm shadow-md relative overflow-hidden flex items-center h-[46px] my-auto">
        {/* 流光裝飾背景 */}
        {isGenerating && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-brand-secondary/5 to-brand-primary/5 animate-pulse pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-pulse" />
          </>
        )}

        <div className="relative flex items-center z-10 w-full h-full">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isOnline && !isGenerating) {
                onOpenOnlineSearch?.();
              }
            }}
            disabled={!isOnline || isGenerating}
            className={`w-full h-full rounded-lg bg-gradient-to-r text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 ${
              isGenerating
                ? 'from-brand-primary/10 via-brand-secondary/10 to-brand-primary/10 animate-pulse border border-brand-primary/30 text-brand-primary shadow-none cursor-wait'
                : !isOnline 
                  ? 'from-brand-primary to-brand-secondary opacity-40 cursor-not-allowed filter grayscale shadow-none' 
                  : 'from-brand-primary to-brand-secondary hover:opacity-95 active:scale-[0.98] shadow-brand-primary/10'
            }`}
          >
            {isGenerating ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping shrink-0" />
                <span>{t('session_ai_generating_with_timer').replace('{seconds}', (elapsedTime || 0).toString())}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isOnline ? t('session_simple_promo_btn') : t('session_simple_promo_btn_offline')}</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default SimpleScorepadPromo;

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
    <div className="w-full flex flex-col items-center gap-4 py-5 select-none animate-in fade-in duration-300">
      
      {/* 標籤框 1：手動新增指引 (緊貼上方加號) */}
      <div className="w-[calc(100%-3rem)] mx-6 p-3.5 rounded-xl border border-surface-border bg-surface-bg-alt/50 backdrop-blur-sm text-txt-secondary text-xs flex items-center gap-2.5 shadow-sm">
        <ArrowUp className="w-4 h-4 text-brand-primary shrink-0 animate-bounce mt-0.5" />
        <span className="leading-relaxed font-semibold">
          {t('session_simple_promo_arrow_hint')}
        </span>
      </div>

      {/* 標籤框 2：AI 智慧生成與探索主卡片 */}
      <div className="w-[calc(100%-3rem)] mx-6 p-5 rounded-xl border border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm shadow-md relative overflow-hidden flex flex-col items-center gap-3">
        {/* 流光裝飾背景 */}
        {isGenerating && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-brand-secondary/5 to-brand-primary/5 animate-pulse pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-pulse" />
          </>
        )}

        <div className="relative flex flex-col items-center gap-3 text-center z-10 w-full">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isOnline && !isGenerating) {
                onOpenOnlineSearch?.();
              }
            }}
            disabled={!isOnline || isGenerating}
            className={`w-full py-3.5 px-4 rounded-xl bg-gradient-to-r text-xs font-semibold text-white transition-all shadow-md flex items-center justify-center gap-2 ${
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
                <Sparkles className="w-4 h-4" />
                <span>{isOnline ? t('session_simple_promo_btn') : t('session_simple_promo_btn_offline')}</span>
              </>
            )}
          </button>
          
          {/* AI 狀態詳細說明文字（即精簡後的 3 行中英文說明） */}
          {isGenerating && (
            <div className="flex flex-col gap-1 text-[11px] text-txt-muted mt-1 w-full text-center">
              <p className="font-semibold text-brand-primary leading-relaxed">
                {t('session_ai_waiting_status_detail') || '🔮 Grid and totals are locked during analysis.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 標籤框 3：直接輸入總分指引 (緊貼下方總分行) */}
      <div className="w-[calc(100%-3rem)] mx-6 p-3.5 rounded-xl border border-surface-border bg-surface-bg-alt/50 backdrop-blur-sm text-txt-secondary text-xs flex items-center justify-center gap-2.5 shadow-sm">
        <ArrowDown className="w-4 h-4 text-brand-primary shrink-0 animate-bounce" />
        <span className="leading-relaxed font-semibold">
          {t('session_simple_promo_totals_hint')}
        </span>
      </div>

    </div>
  );
};

export default SimpleScorepadPromo;

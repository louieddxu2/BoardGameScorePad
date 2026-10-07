import React from 'react';
import type { useAiGenerator } from '../../../features/ai-generator/hooks/useAiGenerator';
import type { useAiSimpleGenerator } from '../../../features/ai-generator/hooks/useAiSimpleGenerator';
import type { useToast } from '../../../hooks/useToast';
import type { useSessionTranslation } from '../../../i18n/session';

interface SessionAiFeedbackOptions {
  aiGenerator: ReturnType<typeof useAiGenerator>;
  aiSimpleGenerator: ReturnType<typeof useAiSimpleGenerator>;
  isAiPromptOpen: boolean;
  showToast: ReturnType<typeof useToast>['showToast'];
  tSession: ReturnType<typeof useSessionTranslation>['t'];
}

/** Keep feedback and unmount cleanup at the owner's original effect position. */
export function useSessionAiFeedback({
  aiGenerator, aiSimpleGenerator, isAiPromptOpen, showToast, tSession
}: SessionAiFeedbackOptions) {
  React.useEffect(() => {
    if (aiGenerator.status === 'error') {
      if (!isAiPromptOpen) {
        showToast({ message: tSession('toast_ai_generation_failed') || 'AI generation failed, please try again.', type: 'error' });
        aiGenerator.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGenerator.status, showToast, tSession, aiGenerator.reset]);

  const aiStatusRef = React.useRef(aiGenerator.status);
  React.useEffect(() => {
    aiStatusRef.current = aiGenerator.status;
  }, [aiGenerator.status]);

  // 元件卸載監聽：AI 生成中若按「上一頁」回到 Dashboard 則彈出中斷提示 Toast 並重置 (0 歷史堆疊風險)
  React.useEffect(() => {
    const currentReset = aiGenerator.reset;
    const currentSimpleReset = aiSimpleGenerator.resetSimple;
    return () => {
      if (aiStatusRef.current === 'compressing' || aiStatusRef.current === 'generating') {
        showToast({ message: tSession('toast_ai_generation_interrupted') || '🔮 AI scoreboard generation aborted.', type: 'info' });
        currentReset();
      }
      currentSimpleReset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

}

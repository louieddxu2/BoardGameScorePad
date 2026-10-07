import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameSession, GameTemplate } from '../../../types';
import type { useToast } from '../../../hooks/useToast';
import type { useSessionTranslation } from '../../../i18n/session';
import { db } from '../../../db';
import { markPendingAiShare } from '../../../utils/pendingAiShare';

interface SessionTemplateApplicationOptions {
  session: GameSession;
  template: GameTemplate;
  onUpdateTemplate: (template: GameTemplate) => Promise<{ template: GameTemplate; session: GameSession | null }>;
  onUpdateSession: (session: GameSession) => void | Promise<void>;
  setIsOnlineSearchOpen: Dispatch<SetStateAction<boolean>>;
  setIsAiPromptOpen: Dispatch<SetStateAction<boolean>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  tSession: ReturnType<typeof useSessionTranslation>['t'];
}

export const useSessionTemplateApplication = ({
  session,
  template,
  onUpdateTemplate: handleTemplateUpdate,
  onUpdateSession: handleSessionUpdate,
  setIsOnlineSearchOpen,
  setIsAiPromptOpen,
  showToast,
  tSession,
}: SessionTemplateApplicationOptions) => {
  // 安全套用社群範本 (重置分數格，更新 columns，安全原地刷新)
  const handleApplyTemplate = useCallback(async (fetched: { payload: unknown }) => {
    let payloadObj: Partial<GameTemplate> | null = null;
    try {
      payloadObj = typeof fetched.payload === 'string'
        ? JSON.parse(fetched.payload)
        : fetched.payload as Partial<GameTemplate> | null;
    } catch (e) {
      console.error("Failed to parse template payload", e);
      return;
    }

    if (!payloadObj) return;

    // 1. 複製玩家並清空所有輸入分數 (原地清空)
    const newPlayers = session.players.map(p => ({
      ...p,
      scores: {}
    }));

    // 2. 原地覆寫模板屬性
    const updatedTemplate: GameTemplate = {
      ...template,
      columns: payloadObj.columns || [],
      defaultScoringRule: payloadObj.defaultScoringRule || template.defaultScoringRule,
      supportedColors: payloadObj.supportedColors || template.supportedColors,
      globalVisuals: payloadObj.globalVisuals || template.globalVisuals,
      imageId: payloadObj.imageId || template.imageId,
      cloudImageId: payloadObj.cloudImageId || template.cloudImageId,
      hasImage: payloadObj.hasImage !== undefined ? payloadObj.hasImage : template.hasImage,
      description: payloadObj.description || template.description,
      updatedAt: Date.now()
    };

    // 3. 重新建立會話物件，並重設 winners
    const updatedSession: GameSession = {
      ...session,
      players: newPlayers,
      winnerIds: [], // 清空 winners
      scoringRule: updatedTemplate.defaultScoringRule,
    };

    // 4. 原地驅動 React 狀態流更新（IndexedDB 寫入由上層 onUpdate 自動非同步完成）
    await handleTemplateUpdate(updatedTemplate);
    await handleSessionUpdate(updatedSession);

    // 5. 標記偏好，記錄此範本以防止重覆推薦
    try {
      void db.templatePrefs.put({
        templateId: updatedTemplate.id,
        lastPlayerCount: session.players.length,
        updatedAt: Date.now()
      }).catch(e => {
        console.error("Failed to record prefs", e);
      });
    } catch (e) {
      console.error("Failed to record prefs", e);
    }

    // 6. 關閉彈窗並彈出提示
    setIsOnlineSearchOpen(false);
    showToast({ message: tSession('toast_apply_template_success'), type: 'success' });
  }, [handleSessionUpdate, handleTemplateUpdate, session, template, showToast, tSession, setIsOnlineSearchOpen]);

  // 安全套用 AI 產生之範本
  const handleAiSuccess = useCallback(async (result: Partial<GameTemplate>) => {
    if (!result.columns || result.columns.length === 0) return;

    // 1. 複製玩家並清空所有輸入分數 (原地清空)
    const newPlayers = session.players.map(p => ({
      ...p,
      scores: {}
    }));

    // 2. 原地覆寫模板欄位
    const updatedTemplate: GameTemplate = {
      ...template,
      columns: result.columns,
      defaultScoringRule: result.defaultScoringRule || template.defaultScoringRule,
      updatedAt: Date.now(),
    };

    // 3. 重新建立會話物件，並重設 winners
    const updatedSession: GameSession = {
      ...session,
      players: newPlayers,
      winnerIds: [],
      scoringRule: updatedTemplate.defaultScoringRule,
    };

    // 4. 原地驅動 React 狀態更新
    await handleTemplateUpdate(updatedTemplate);
    await handleSessionUpdate(updatedSession);

    // 5. 記憶體標記：待首次結束遊戲 Save to History 時詢問分享
    markPendingAiShare(template.id);

    // 6. 關閉彈窗與拍照介面，彈出提示
    setIsAiPromptOpen(false);
    setIsOnlineSearchOpen(false);
    showToast({ message: tSession('toast_ai_apply_success'), type: 'success' });
  }, [handleSessionUpdate, handleTemplateUpdate, session, template, showToast, tSession, setIsAiPromptOpen, setIsOnlineSearchOpen]);

  return { handleApplyTemplate, handleAiSuccess };
};

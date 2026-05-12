import { useState, useCallback } from 'react';
import { GameTemplate, ScoringRule, ScoreColumn } from '../../../types';
import { GameOption } from '../types';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../db';
import { generateId } from '../../../utils/idGenerator';
import { useAppTranslation } from '../../../i18n/app';
import { createTemplateFromOption } from '../../../utils/templateUtils';
import { useAiGenerator } from '../../ai-generator/hooks/useAiGenerator';

interface UseGameLauncherProps {
  allVisibleTemplates: GameTemplate[];
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean; preserveTimestamps?: boolean }) => void;
  onGameStart: (template: GameTemplate, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => void;
}

interface PendingLaunchData {
  option: GameOption;
  playerCount: number;
  location: string;
  locationId?: string;
  extra?: { startTimeStr?: string, scoringRule?: ScoringRule };
}

export const useGameLauncher = ({
  allVisibleTemplates,
  onGetFullTemplate,
  onTemplateSave,
  onGameStart
}: UseGameLauncherProps) => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();
  
  // 取得 AI 解鎖狀態
  const { isAiUnlocked } = useAiGenerator();
  
  // 暫存即將啟動的參數，用於觸發彈窗
  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunchData | null>(null);

  /**
   * 正式執行啟動（內部函式，供直接啟動或 AI 完成後呼叫）
   */
  const executeLaunch = async (
    data: PendingLaunchData,
    injectedColumns?: ScoreColumn[]
  ) => {
    const { option, playerCount, location, locationId, extra } = data;
    let templateToStart: GameTemplate;

    // 1. 解析 Template 來源
    if (option.templateId) {
      let found: GameTemplate | undefined | null = allVisibleTemplates.find(t => t.id === option.templateId);
      if (!found) found = await onGetFullTemplate(option.templateId);
      
      if (found) {
        templateToStart = found;
      } else {
        showToast({ message: t('app_toast_launch_error'), type: 'error' });
        return;
      }
    } else {
      // 建立新模板
      templateToStart = createTemplateFromOption(option, {
        lastPlayerCount: playerCount
      });
      
      // 如果有 AI 注入的欄位，在此時填入
      if (injectedColumns && injectedColumns.length > 0) {
        templateToStart.columns = injectedColumns;
      }

      await onTemplateSave(templateToStart, { skipCloud: true });
    }

    // 如果是現有模板，但這次透過 AI 掃描注入了欄位
    if (injectedColumns && injectedColumns.length > 0 && templateToStart.id === option.templateId) {
        templateToStart = { ...templateToStart, columns: injectedColumns };
        await onTemplateSave(templateToStart, { skipCloud: true });
    }

    try {
      // 2. 紀錄偏好
      await db.templatePrefs.put({
        templateId: templateToStart.id,
        lastPlayerCount: playerCount,
        updatedAt: Date.now()
      });

      // 3. 啟動遊戲
      onGameStart(templateToStart, playerCount, location, locationId, extra);
    } catch (e) {
      console.error("Failed to start game", e);
      onGameStart(templateToStart, playerCount, location, locationId, extra);
    } finally {
      // 清空暫存狀態
      setPendingLaunch(null);
    }
  };

  /**
   * 面板點擊 Start 的主要入口 (攔截點)
   */
  const handlePanelStart = async (
    option: GameOption, 
    playerCount: number, 
    location: string, 
    locationId?: string, 
    extra?: { startTimeStr?: string, scoringRule?: ScoringRule }
  ) => {
    // 判斷是否為簡易遊戲
    // 簡易遊戲定義：沒有 templateId，或是該 template 的 columns 為空
    let isSimple = !option.templateId;
    if (option.templateId) {
        const found = allVisibleTemplates.find(t => t.id === option.templateId);
        if (found && (!found.columns || found.columns.length === 0)) {
            isSimple = true;
        }
    }

    const currentPayload: PendingLaunchData = { option, playerCount, location, locationId, extra };

    // 攔截條件：解鎖進階使用者 && 是簡易遊戲
    if (isAiUnlocked && isSimple) {
        // 暫緩啟動，觸發 UI 彈窗
        setPendingLaunch(currentPayload);
    } else {
        // 無解鎖或已有結構，直接啟動
        await executeLaunch(currentPayload);
    }
  };

  return { 
    handlePanelStart,
    pendingLaunch,
    cancelAiLaunch: () => setPendingLaunch(null),
    // 提供給外部直接跳過 AI 啟動的接口
    confirmDirectLaunch: () => pendingLaunch && executeLaunch(pendingLaunch),
    // 提供給外部注入 AI 結果後啟動的接口
    confirmAiLaunch: (result: Partial<GameTemplate>) => {
        if (!pendingLaunch) return;
        executeLaunch(pendingLaunch, result.columns as ScoreColumn[] || []);
    }
  };
};

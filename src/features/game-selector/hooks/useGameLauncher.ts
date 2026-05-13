import { useState, useCallback } from 'react';
import { GameTemplate, ScoringRule, ScoreColumn } from '../../../types';
import { GameOption } from '../types';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../db';
import { generateId } from '../../../utils/idGenerator';
import { useAppTranslation } from '../../../i18n/app';
import { createTemplateFromOption } from '../../../utils/templateUtils';

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
    // 官方極簡判定契約：當 option.templateId 存在時，代表該遊戲已有「專屬計分板結構」，不該被當成簡易板！
    const isVirtual = option.uid === '__CREATE_NEW__';
    const isSimple = !option.templateId && !isVirtual;

    const currentPayload: PendingLaunchData = { option, playerCount, location, locationId, extra };

    // 即時讀取解鎖狀態
    const isCurrentlyUnlocked = localStorage.getItem('advance_user') === 'true';


    // 攔截條件：解鎖進階使用者 && 是簡易遊戲
    if (isCurrentlyUnlocked && isSimple) {
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

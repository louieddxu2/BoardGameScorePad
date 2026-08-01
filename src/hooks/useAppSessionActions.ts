import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AppView, GameTemplate, ScoringRule } from '../types';
import { db } from '../db';
import { useAppData } from './useAppData';
import { useAiTemplateShareConfirm } from './useAiTemplateShareConfirm';
import { useMultiplayerRoomLifecycle } from './useMultiplayerRoomLifecycle';
import type { ActiveMultiplayerRoom } from './useMultiplayerRoomLifecycle';
import { shouldTriggerIOSPwaGuide } from '../components/modals/IOSPwaGuide';

type AppData = ReturnType<typeof useAppData>;
type MultiplayerRoomLifecycle = ReturnType<typeof useMultiplayerRoomLifecycle>;

type UseAppSessionActionsOptions = {
  appData: AppData;
  activeMultiplayerRoom: ActiveMultiplayerRoom | null;
  releaseHostMultiplayerRoom: MultiplayerRoomLifecycle['releaseHostMultiplayerRoom'];
  releaseParticipantMultiplayerRoom: MultiplayerRoomLifecycle['releaseParticipantMultiplayerRoom'];
  tryRestoreMultiplayerRoom: MultiplayerRoomLifecycle['tryRestoreMultiplayerRoom'];
  transitionToDashboard: () => void;
  captureAiTemplateForSharing: ReturnType<typeof useAiTemplateShareConfirm>['captureAiTemplateForSharing'];
  shouldTriggerIOSPwaGuide: typeof shouldTriggerIOSPwaGuide;
  setView: Dispatch<SetStateAction<AppView>>;
  setPendingTemplate: Dispatch<SetStateAction<GameTemplate | null>>;
  setEditorInitialName: Dispatch<SetStateAction<string | undefined>>;
  setIsIOSPwaGuideVisible: Dispatch<SetStateAction<boolean>>;
};

export const useAppSessionActions = ({
  appData,
  activeMultiplayerRoom,
  releaseHostMultiplayerRoom,
  releaseParticipantMultiplayerRoom,
  tryRestoreMultiplayerRoom,
  transitionToDashboard,
  captureAiTemplateForSharing,
  shouldTriggerIOSPwaGuide: shouldShowIOSPwaGuide,
  setView,
  setPendingTemplate,
  setEditorInitialName,
  setIsIOSPwaGuideVisible,
}: UseAppSessionActionsOptions) => {
  const initSetup = useCallback((template: GameTemplate) => {
    setPendingTemplate(template);
  }, [setPendingTemplate]);

  const resumeSessionWithRoom = useCallback(async (templateId: string, pendingTemplateId?: string) => {
    const activeSession = appData.activeSessions?.find(s => s.templateId === templateId);
    const success = await appData.resumeSession(templateId);
    if (!success) return false;

    let sessionId = activeSession?.id;
    if (!sessionId) {
      const session = await db.sessions.where('templateId').equals(templateId).and(item => item.status === 'active').first();
      sessionId = session?.id;
    }
    if (sessionId) {
      await tryRestoreMultiplayerRoom(sessionId);
    }
    if (pendingTemplateId === undefined || pendingTemplateId === templateId) {
      setPendingTemplate(null);
    }
    setView(AppView.ACTIVE_SESSION);
    return true;
  }, [appData, setPendingTemplate, setView, tryRestoreMultiplayerRoom]);

  const handleResumeGame = useCallback(async (templateId: string) => {
    await resumeSessionWithRoom(templateId, templateId);
  }, [resumeSessionWithRoom]);

  const handleDirectResume = useCallback(async (templateId: string) => {
    await resumeSessionWithRoom(templateId);
  }, [resumeSessionWithRoom]);

  const handleCloseMultiplayerRoom = useCallback(async () => {
    try {
      const releasedSession = await releaseHostMultiplayerRoom();
      if (releasedSession) await appData.resumeSessionById(releasedSession.id);
    } catch (err) {
      console.warn('[multiplayer] Failed to close host room:', err);
    }
  }, [appData, releaseHostMultiplayerRoom]);

  const handleLeaveMultiplayerRoom = useCallback(async () => {
    try {
      await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
    } catch (err) {
      console.warn('[multiplayer] Failed to leave participant room:', err);
    }
  }, [releaseParticipantMultiplayerRoom]);

  const handleStartNewGame = useCallback(async (template: GameTemplate, count: number, options: { startTimeStr: string; scoringRule: ScoringRule }) => {
    if (!template) return;

    if (appData.activeSessionIds.includes(template.id)) {
      await appData.discardSession(template.id);
    }

    await appData.startSession(template, count, options);
    setView(AppView.ACTIVE_SESSION);
    setPendingTemplate(null);
  }, [appData, setPendingTemplate, setView]);

  const handleQuickStart = useCallback(async (
    template: GameTemplate,
    playerCount: number,
    location: string,
    locationId?: string,
    extra?: { startTimeStr?: string; scoringRule?: ScoringRule },
  ) => {
    if (appData.activeSessionIds.includes(template.id)) {
      await appData.discardSession(template.id);
    }

    await appData.startSession(template, playerCount, {
      startTimeStr: extra?.startTimeStr,
      scoringRule: extra?.scoringRule || template.defaultScoringRule || 'HIGHEST_WINS',
      location,
      locationId,
    });
    setView(AppView.ACTIVE_SESSION);
  }, [appData, setView]);

  const handleExitSession = useCallback(async (location?: string) => {
    try {
      if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: false });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release participant room on exit:', err);
    } finally {
      appData.exitSession(location !== undefined ? { location } : undefined);
      transitionToDashboard();
    }
  }, [activeMultiplayerRoom, appData, releaseParticipantMultiplayerRoom, transitionToDashboard]);

  const handleSaveToHistory = useCallback(async (location?: string) => {
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on save:', err);
    } finally {
      captureAiTemplateForSharing(appData.activeTemplate);
      await appData.saveToHistory(location);
      transitionToDashboard();

      if (shouldShowIOSPwaGuide()) {
        setIsIOSPwaGuideVisible(true);
      }
    }
  }, [activeMultiplayerRoom, appData, captureAiTemplateForSharing, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom, setIsIOSPwaGuideVisible, transitionToDashboard]);

  const handleDiscard = useCallback(async () => {
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on discard:', err);
    } finally {
      if (appData.activeTemplate) {
        await appData.discardSession(appData.activeTemplate.id);
        transitionToDashboard();
      }
    }
  }, [activeMultiplayerRoom, appData, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom, transitionToDashboard]);

  const handleTemplateSave = useCallback(async (template: GameTemplate) => {
    await appData.saveTemplate(template);
    const defaultCount = appData.sessionPlayerCount || template.lastPlayerCount || 4;

    await appData.startSession(template, defaultCount, {
      startTimeStr: undefined,
      scoringRule: template.defaultScoringRule || 'HIGHEST_WINS',
    });

    setView(AppView.ACTIVE_SESSION);
    setEditorInitialName(undefined);
  }, [appData, setEditorInitialName, setView]);

  const handleBatchImport = useCallback((templates: GameTemplate[]) => {
    templates.forEach(template => appData.saveTemplate(template));
    setView(AppView.DASHBOARD);
  }, [appData, setView]);

  const handleHistorySelect = useCallback(async (record: { id: string }) => {
    await appData.viewHistory(record.id);
    setView(AppView.HISTORY_REVIEW);
  }, [appData, setView]);

  const handleHistoryExit = useCallback(() => {
    appData.viewHistory(null);
    transitionToDashboard();
  }, [appData, transitionToDashboard]);

  return {
    initSetup,
    handleResumeGame,
    handleDirectResume,
    handleCloseMultiplayerRoom,
    handleLeaveMultiplayerRoom,
    handleStartNewGame,
    handleQuickStart,
    handleExitSession,
    handleSaveToHistory,
    handleDiscard,
    handleTemplateSave,
    handleBatchImport,
    handleHistorySelect,
    handleHistoryExit,
  };
};

export type AppDataActions = ReturnType<typeof useAppSessionActions>;

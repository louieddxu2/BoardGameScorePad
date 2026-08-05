import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AppView, GameTemplate, ScoringRule } from '../types';
import { db } from '../db';
import { useAppData } from './useAppData';
import { useAiTemplateShareConfirm } from './useAiTemplateShareConfirm';
import { useMultiplayerRoomLifecycle } from './useMultiplayerRoomLifecycle';
import type { ActiveMultiplayerRoom } from './useMultiplayerRoomLifecycle';
import { shouldTriggerIOSPwaGuide } from '../components/modals/IOSPwaGuide';
import type { EnterActiveSession } from '../utils/activeSessionNavigation';

type AppData = ReturnType<typeof useAppData>;
type MultiplayerRoomLifecycle = ReturnType<typeof useMultiplayerRoomLifecycle>;

type UseAppSessionActionsOptions = {
  appData: AppData;
  activeMultiplayerRoom: ActiveMultiplayerRoom | null;
  releaseHostMultiplayerRoom: MultiplayerRoomLifecycle['releaseHostMultiplayerRoom'];
  releaseParticipantMultiplayerRoom: MultiplayerRoomLifecycle['releaseParticipantMultiplayerRoom'];
  releaseMultiplayerRoomForSession: MultiplayerRoomLifecycle['releaseMultiplayerRoomForSession'];
  tryRestoreMultiplayerRoom: MultiplayerRoomLifecycle['tryRestoreMultiplayerRoom'];
  enterActiveSession: EnterActiveSession;
  prepareMultiplayerSessionExit: MultiplayerRoomLifecycle['prepareMultiplayerSessionExit'];
  finalizeMultiplayerSessionExit: MultiplayerRoomLifecycle['finalizeMultiplayerSessionExit'];
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
  releaseMultiplayerRoomForSession,
  tryRestoreMultiplayerRoom,
  enterActiveSession,
  prepareMultiplayerSessionExit,
  finalizeMultiplayerSessionExit,
  transitionToDashboard,
  captureAiTemplateForSharing,
  shouldTriggerIOSPwaGuide: shouldShowIOSPwaGuide,
  setView,
  setPendingTemplate,
  setEditorInitialName,
  setIsIOSPwaGuideVisible,
}: UseAppSessionActionsOptions) => {
  const sessionTransitionInFlightRef = useRef(false);

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
    enterActiveSession('resume-active-session');
    return true;
  }, [appData, enterActiveSession, setPendingTemplate, tryRestoreMultiplayerRoom]);

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
    enterActiveSession('start-new-session');
    setPendingTemplate(null);
  }, [appData, enterActiveSession, setPendingTemplate]);

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
    enterActiveSession('start-new-session');
  }, [appData, enterActiveSession]);

  const handleExitSession = useCallback(async (location?: string) => {
    if (sessionTransitionInFlightRef.current) return;
    sessionTransitionInFlightRef.current = true;
    prepareMultiplayerSessionExit();
    try {
      if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: false });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release participant room on exit:', err);
    }
    try {
      await appData.exitSession(location !== undefined ? { location } : undefined);
    } catch (err) {
      console.warn('[session] Failed to persist active session on exit:', err);
    } finally {
      try {
        finalizeMultiplayerSessionExit();
        transitionToDashboard();
      } finally {
        sessionTransitionInFlightRef.current = false;
      }
    }
  }, [activeMultiplayerRoom, appData, finalizeMultiplayerSessionExit, prepareMultiplayerSessionExit, releaseParticipantMultiplayerRoom, transitionToDashboard]);

  const handleSaveToHistory = useCallback(async (location?: string) => {
    if (sessionTransitionInFlightRef.current) return;
    sessionTransitionInFlightRef.current = true;
    prepareMultiplayerSessionExit();
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on save:', err);
    }
    try {
      captureAiTemplateForSharing(appData.activeTemplate);
      await appData.saveToHistory(location);
    } catch (err) {
      console.warn('[session] Failed to save session to history:', err);
    } finally {
      try {
        finalizeMultiplayerSessionExit();
        transitionToDashboard();

        if (shouldShowIOSPwaGuide()) {
          setIsIOSPwaGuideVisible(true);
        }
      } finally {
        sessionTransitionInFlightRef.current = false;
      }
    }
  }, [activeMultiplayerRoom, appData, captureAiTemplateForSharing, finalizeMultiplayerSessionExit, prepareMultiplayerSessionExit, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom, setIsIOSPwaGuideVisible, transitionToDashboard]);

  const handleDiscard = useCallback(async () => {
    if (sessionTransitionInFlightRef.current) return;
    sessionTransitionInFlightRef.current = true;
    prepareMultiplayerSessionExit();
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on discard:', err);
    }
    try {
      if (appData.activeTemplate) await appData.discardSession(appData.activeTemplate.id);
    } catch (err) {
      console.warn('[session] Failed to discard active session:', err);
    } finally {
      try {
        finalizeMultiplayerSessionExit();
        transitionToDashboard();
      } finally {
        sessionTransitionInFlightRef.current = false;
      }
    }
  }, [activeMultiplayerRoom, appData, finalizeMultiplayerSessionExit, prepareMultiplayerSessionExit, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom, transitionToDashboard]);

  const handleDiscardActiveSession = useCallback(async (templateId: string) => {
    const session = appData.activeSessions?.find((item) => item.templateId === templateId)
      ?? await db.sessions.where('templateId').equals(templateId).and((item) => item.status === 'active').first();
    if (session) await releaseMultiplayerRoomForSession(session.id);
    await appData.discardSession(templateId);
  }, [appData, releaseMultiplayerRoomForSession]);

  const handleClearAllActiveSessions = useCallback(async () => {
    const sessions = appData.activeSessions ?? await db.sessions.where('status').equals('active').toArray();
    for (const session of sessions) await releaseMultiplayerRoomForSession(session.id);
    await appData.clearAllActiveSessions();
  }, [appData, releaseMultiplayerRoomForSession]);

  const handleTemplateSave = useCallback(async (template: GameTemplate) => {
    await appData.saveTemplate(template);
    const defaultCount = appData.sessionPlayerCount || template.lastPlayerCount || 4;

    await appData.startSession(template, defaultCount, {
      startTimeStr: undefined,
      scoringRule: template.defaultScoringRule || 'HIGHEST_WINS',
    });

    enterActiveSession('start-new-session');
    setEditorInitialName(undefined);
  }, [appData, enterActiveSession, setEditorInitialName]);

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
    handleDiscardActiveSession,
    handleClearAllActiveSessions,
    handleTemplateSave,
    handleBatchImport,
    handleHistorySelect,
    handleHistoryExit,
  };
};

export type AppDataActions = ReturnType<typeof useAppSessionActions>;

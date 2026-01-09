
import { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { GameTemplate, GameSession, Player, ScoringRule, HistoryRecord } from '../types';
import { generateId } from '../utils/idGenerator';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';
import { calculatePlayerTotal } from '../utils/scoring';
import { imageService } from '../services/imageService';
import { googleDriveService } from '../services/googleDrive';
import { cleanupService } from '../services/cleanupService';
import { useToast } from './useToast';
import { COLORS } from '../colors';

interface UseSessionManagerProps {
    getTemplate: (id: string) => Promise<GameTemplate | null>;
    activeSessions: GameSession[] | undefined;
    updatePlayerHistory: (name: string) => void;
    isCloudEnabled: () => boolean;
}

export const useSessionManager = ({ 
    getTemplate, 
    activeSessions, 
    updatePlayerHistory, 
    isCloudEnabled 
}: UseSessionManagerProps) => {
    
  const { showToast } = useToast();
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);
  
  // Track if image has changed to trigger cloud sync on exit
  const isImageDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-revoke Object URL to prevent memory leaks
  useEffect(() => {
      return () => {
          if (sessionImage && sessionImage.startsWith('blob:')) {
              URL.revokeObjectURL(sessionImage);
          }
      };
  }, [sessionImage]);

  // Auto-save session debounce
  useEffect(() => {
    if (!currentSession) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        db.sessions.put(currentSession).catch(err => console.error("Failed to autosave:", err));
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currentSession]);

  const startSession = async (
      partialTemplate: GameTemplate, 
      playerCount: number, 
      options?: { startTimeStr?: string, scoringRule?: ScoringRule }
  ) => {
    setSessionPlayerCount(playerCount);
    const scoringRule = options?.scoringRule || 'HIGHEST_WINS';
    try {
        await db.templatePrefs.put({
            templateId: partialTemplate.id,
            lastPlayerCount: playerCount,
            defaultScoringRule: scoringRule,
            updatedAt: Date.now()
        });
    } catch (e) { console.warn("Failed to save preferences", e); }

    const fullTemplate = await getTemplate(partialTemplate.id);
    if (!fullTemplate) {
        showToast({ message: "無法讀取模板資料", type: 'error' });
        return;
    }
    const migratedTemplate = migrateTemplate(fullTemplate);
    migratedTemplate.lastPlayerCount = playerCount;
    migratedTemplate.defaultScoringRule = scoringRule;

    const hasTexture = !!migratedTemplate.globalVisuals || !!migratedTemplate.hasImage;
    const defaultColors = hasTexture 
        ? Array(playerCount).fill('transparent') 
        : Array.from({ length: playerCount }, (_, i) => COLORS[i % COLORS.length]);

    const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: generateId(8),
      name: `玩家 ${i + 1}`,
      scores: {},
      totalScore: 0,
      color: defaultColors[i]
    }));
    
    let startTime = Date.now();
    if (options?.startTimeStr) {
        const [hours, minutes] = options.startTimeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            const date = new Date();
            date.setHours(hours);
            date.setMinutes(minutes);
            startTime = date.getTime();
        }
    }

    const sessionId = generateId();
    const newSession: GameSession = { 
        id: sessionId, 
        templateId: migratedTemplate.id, 
        startTime: startTime, 
        players: players, 
        status: 'active',
        scoringRule: scoringRule,
        cloudFolderId: undefined, 
        photos: [] 
    };
    
    isImageDirtyRef.current = false;
    
    // [Optimization] Load Image: Fetch Blob directly from DB
    let loadedImageUrl: string | null = null;
    if (migratedTemplate.imageId) {
        const localImg = await imageService.getImage(migratedTemplate.imageId);
        if (localImg) {
            loadedImageUrl = URL.createObjectURL(localImg.blob);
        }
    }
    
    setSessionImage(loadedImageUrl);
    setActiveTemplate(migratedTemplate);
    setCurrentSession(newSession);
  };

  const resumeSession = async (templateId: string): Promise<boolean> => {
      try {
          const session = await db.sessions.where('templateId').equals(templateId).and(s => s.status === 'active').first();
          if (!session) return false;
          let template = await getTemplate(templateId);
          if (template) {
              template = migrateTemplate(template);
              session.players = session.players.map((p: any) => ({ 
                  ...p, scores: migrateScores(p.scores, template!) 
              }));
              
              // Load Image
              let loadedImageUrl: string | null = null;
              if (template.imageId) {
                  const localImg = await imageService.getImage(template.imageId);
                  if (localImg) {
                      loadedImageUrl = URL.createObjectURL(localImg.blob);
                  }
              }

              setSessionImage(loadedImageUrl);
              setActiveTemplate(template);
              setCurrentSession(session);
              return true;
          }
      } catch (e) { console.error("Failed to resume session", e); }
      return false;
  };

  const discardSession = async (templateId: string) => {
      const session = activeSessions?.find(s => s.templateId === templateId);
      if (session) {
          // Use cleanup service for artifacts
          await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
          await db.sessions.delete(session.id);
      }
      if (currentSession?.templateId === templateId) { 
          setCurrentSession(null); 
          setActiveTemplate(null); 
      }
  };

  const clearAllActiveSessions = async () => {
      // Use cleanup service batch logic implicitly by iterating
      // Or explicit logic here
      const activeIds = activeSessions?.map(s => s.id) || [];
      if (activeIds.length > 0 && activeSessions) {
          for (const session of activeSessions) {
              await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
          }
          await db.sessions.bulkDelete(activeIds);
      }
  };

  const updateSession = (updatedSession: GameSession) => {
      if (activeTemplate) {
        const playersWithTotal = updatedSession.players.map(p => ({ 
            ...p, totalScore: calculatePlayerTotal(p, activeTemplate, updatedSession.players) 
        }));
        setCurrentSession({ ...updatedSession, players: playersWithTotal });
      } else {
        setCurrentSession(updatedSession);
      }
  };
  
  const resetSessionScores = () => {
    if (!currentSession) return;
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0, bonusScore: 0 }));
    setCurrentSession({ ...currentSession, players: resetPlayers, startTime: Date.now() });
  };

  const exitSession = async () => {
      if (!currentSession) return;

      const hasScores = currentSession.players.some(p => Object.keys(p.scores).length > 0 || (p.bonusScore || 0) !== 0);
      const hasPhotos = (currentSession.photos && currentSession.photos.length > 0);
      const hasDataToSave = hasScores || hasPhotos;

      if (!hasDataToSave) {
          // Empty -> Discard
          await cleanupService.cleanSessionArtifacts(currentSession.id, currentSession.cloudFolderId);
          await db.sessions.delete(currentSession.id);
      } else {
          // Save
          await db.sessions.put(currentSession);
          if (isCloudEnabled()) {
              let folderId = currentSession.cloudFolderId;
              if (!folderId && activeTemplate) {
                  folderId = await googleDriveService.createActiveSessionFolder(activeTemplate.name, currentSession.id);
                  await db.sessions.update(currentSession.id, { cloudFolderId: folderId });
              }

              if (folderId) {
                  // Backup session JSON with photo sync
                  await googleDriveService.backupActiveSession(currentSession, activeTemplate.name, folderId);
              }
          }
      }

      // Sync template image if modified
      const isSystem = activeTemplate && !!(await db.builtins.get(activeTemplate.id));
      if (activeTemplate && !isSystem && isCloudEnabled() && isImageDirtyRef.current) {
          googleDriveService.backupTemplate(activeTemplate).then((updated) => {
              db.templates.update(updated.id, { lastSyncedAt: Date.now() });
          }).catch(console.error);
      }

      setCurrentSession(null); 
      setActiveTemplate(null); 
      setSessionImage(null); 
      isImageDirtyRef.current = false;
  };

  const saveToHistory = async () => {
      if (!currentSession || !activeTemplate) return;
      try {
          const rule = currentSession.scoringRule || 'HIGHEST_WINS';
          let winnerIds: string[] = [];
          if (rule === 'HIGHEST_WINS') {
              const maxScore = Math.max(...currentSession.players.map(p => p.totalScore));
              winnerIds = currentSession.players.filter(p => p.totalScore === maxScore).map(p => p.id);
          } else if (rule === 'LOWEST_WINS') {
              const minScore = Math.min(...currentSession.players.map(p => p.totalScore));
              winnerIds = currentSession.players.filter(p => p.totalScore === minScore).map(p => p.id);
          }
          const snapshotTemplate = JSON.parse(JSON.stringify(activeTemplate));
          const record: HistoryRecord = {
              id: currentSession.id, 
              templateId: activeTemplate.id,
              gameName: activeTemplate.name,
              startTime: currentSession.startTime,
              endTime: Date.now(),
              players: currentSession.players,
              winnerIds: winnerIds,
              snapshotTemplate: snapshotTemplate,
              location: undefined,
              note: '',
              photos: currentSession.photos || [],
              cloudFolderId: currentSession.cloudFolderId 
          };
          
          await db.history.put(record); 
          
          currentSession.players.forEach(p => { updatePlayerHistory(p.name); });
          await db.sessions.delete(currentSession.id);

          if (isCloudEnabled()) {
              let folderId = record.cloudFolderId;
              if (!folderId) {
                  folderId = await googleDriveService.createActiveSessionFolder(activeTemplate.name, currentSession.id);
                  await db.history.update(record.id, { cloudFolderId: folderId });
              }
              
              if (folderId) {
                  // Backup history JSON with photo sync
                  await googleDriveService.backupHistoryRecord(record, folderId);
                  await googleDriveService.moveSessionToHistory(folderId);
              }
          }
          
          setCurrentSession(null); setActiveTemplate(null); setSessionImage(null); isImageDirtyRef.current = false;
          showToast({ message: "遊戲紀錄已儲存！", type: 'success' });
      } catch (error) {
          console.error("Save to history failed:", error);
          showToast({ message: "儲存失敗，請重試", type: 'error' });
      }
  };

  const updateActiveTemplate = async (updatedTemplate: GameTemplate) => {
      const migratedTemplate = migrateTemplate({ ...updatedTemplate, updatedAt: Date.now() });
      setActiveTemplate(migratedTemplate);
      const isSystem = !!(await db.builtins.get(migratedTemplate.id));
      if (isSystem) await db.systemOverrides.put(migratedTemplate);
      else await db.templates.put(migratedTemplate);
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({ 
              ...player, totalScore: calculatePlayerTotal(player, migratedTemplate, currentSession.players) 
          }));
          setCurrentSession({ ...currentSession, players: updatedPlayers });
      }
  };

  const handleUpdateSessionImage = async (imgBlobOrUrl: string | Blob | null) => {
      if (!activeTemplate || !imgBlobOrUrl) {
          // If clearing image, we should probably delete the old one too
          if (activeTemplate?.imageId) {
              await imageService.deleteImage(activeTemplate.imageId);
              const updatedT = { ...activeTemplate, imageId: undefined, hasImage: false, cloudImageId: undefined };
              updateActiveTemplate(updatedT);
          }
          setSessionImage(null);
          return;
      }
      
      let blob: Blob;
      if (typeof imgBlobOrUrl === 'string') {
          blob = imageService.base64ToBlob(imgBlobOrUrl);
      } else {
          blob = imgBlobOrUrl;
      }

      // [Clean up Old Image] Before saving new one
      if (activeTemplate.imageId) {
          try {
              await imageService.deleteImage(activeTemplate.imageId);
          } catch (e) {
              console.warn("Failed to delete old template image", e);
          }
      }

      isImageDirtyRef.current = true;
      const savedImg = await imageService.saveImage(blob, activeTemplate.id, 'template');
      
      if (sessionImage) URL.revokeObjectURL(sessionImage);
      setSessionImage(URL.createObjectURL(blob));

      // Reset cloudImageId to force re-upload
      const updatedT = { ...activeTemplate, imageId: savedImg.id, hasImage: true, cloudImageId: undefined };
      updateActiveTemplate(updatedT); 
  };

  return {
      currentSession,
      activeTemplate,
      sessionImage,
      sessionPlayerCount,
      startSession,
      resumeSession,
      discardSession,
      clearAllActiveSessions,
      updateSession,
      resetSessionScores,
      exitSession,
      saveToHistory,
      updateActiveTemplate,
      setSessionImage: handleUpdateSessionImage
  };
};

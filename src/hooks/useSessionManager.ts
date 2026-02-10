

import { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { GameTemplate, GameSession, Player, ScoringRule, HistoryRecord } from '../types';
import { generateId } from '../utils/idGenerator';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';
import { calculatePlayerTotal } from '../utils/scoring';
import { imageService } from '../services/imageService';
import { googleDriveService } from '../services/googleDrive';
import { cleanupService } from '../services/cleanupService';
import { relationshipService } from '../services/relationshipService'; 
import { useToast } from './useToast';
import { COLORS } from '../colors';
import { useLibrary } from './useLibrary';
import { isDisposableTemplate, calculateWinners, prepareTemplateForSave, createVirtualTemplate } from '../utils/templateUtils';

interface UseSessionManagerProps {
    getTemplate: (id: string) => Promise<GameTemplate | null>;
    activeSessions: GameSession[] | undefined;
    isCloudEnabled: () => boolean;
}

export const useSessionManager = ({ 
    getTemplate, 
    activeSessions, 
    isCloudEnabled 
}: UseSessionManagerProps) => {
    
  const { showToast } = useToast();
  
  const { updatePlayer } = useLibrary();

  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);
  
  const isImageDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      return () => {
          if (sessionImage && sessionImage.startsWith('blob:')) {
              URL.revokeObjectURL(sessionImage);
          }
      };
  }, [sessionImage]);

  useEffect(() => {
    if (!currentSession) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        db.sessions.put(currentSession).catch(err => console.error("Failed to autosave:", err));
    }, 1000);
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
    
    // [Color Logic Update]
    // 1. Get Preferred colors
    const preferred = migratedTemplate.supportedColors || [];
    // 2. Get Remaining colors (System colors excluding preferred ones)
    const remaining = COLORS.filter(c => !preferred.includes(c));
    // 3. Combine: Preferred first, then remaining
    const fullPalette = [...preferred, ...remaining];

    const defaultColors = hasTexture 
        ? Array(playerCount).fill('transparent') 
        : Array.from({ length: playerCount }, (_, i) => fullPalette[i % fullPalette.length]);

    const players: Player[] = Array.from({ length: playerCount }, (_, i) => {
      return {
        id: `player_${i + 1}`, 
        name: `玩家 ${i + 1}`,
        scores: {},
        totalScore: 0,
        color: defaultColors[i]
      };
    });
    
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
        // [Identity Upgrade] Copy identity from template to session
        name: migratedTemplate.name,
        bggId: migratedTemplate.bggId,
        
        startTime: startTime, 
        lastUpdatedAt: Date.now(),
        players: players, 
        status: 'active',
        scoringRule: scoringRule,
        cloudFolderId: undefined, 
        photos: [],
        location: '', // Init location
        locationId: undefined
    };
    
    isImageDirtyRef.current = false;
    
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
          
          // [Fail-Safe Reader]
          // If the template is missing (deleted), create a virtual one using session data.
          // This prevents the app from crashing and allows the user to finish the game.
          if (!template) {
              console.warn(`Template ${templateId} missing for session ${session.id}. Creating virtual fallback.`);
              template = createVirtualTemplate(
                  templateId,
                  session.name || "Unknown Game",
                  session.bggId,
                  session.startTime,
                  session.players.length,
                  session.scoringRule
              );
          }

          // At this point, template is guaranteed to be a valid GameTemplate object
          template = migrateTemplate(template);
          
          session.players = session.players.map((p: any) => ({ 
              ...p, scores: migrateScores(p.scores, template!) 
          }));
          
          // [Identity Upgrade] Backfill legacy sessions
          if (!session.name && template) {
              session.name = template.name;
          }
          if (session.bggId === undefined && template) {
              session.bggId = template.bggId;
          }
          
          if (!session.lastUpdatedAt) {
              session.lastUpdatedAt = Date.now();
          }

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

      } catch (e) { console.error("Failed to resume session", e); }
      return false;
  };

  const discardSession = async (templateId: string) => {
      const session = activeSessions?.find(s => s.templateId === templateId);
      
      // [Cleanup Logic]
      if (session) {
          // 1. Clean session artifacts
          await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
          await db.sessions.delete(session.id);

          // 2. Auto-cleanup disposable template
          await cleanupService.cleanupDisposableTemplate(templateId);
      }

      if (currentSession?.templateId === templateId) { 
          setCurrentSession(null); 
          setActiveTemplate(null); 
      }
  };

  const clearAllActiveSessions = async () => {
      const activeIds = activeSessions?.map(s => s.id) || [];
      if (activeIds.length > 0 && activeSessions) {
          for (const session of activeSessions) {
              await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
          }
          await db.sessions.bulkDelete(activeIds);
      }
  };

  const updateSession = (updatedSession: GameSession) => {
      const sessionWithTimestamp = { ...updatedSession, lastUpdatedAt: Date.now() }; 
      
      if (activeTemplate) {
        const playersWithTotal = sessionWithTimestamp.players.map(p => ({ 
            ...p, totalScore: calculatePlayerTotal(p, activeTemplate, sessionWithTimestamp.players) 
        }));
        setCurrentSession({ ...sessionWithTimestamp, players: playersWithTotal });
      } else {
        setCurrentSession(sessionWithTimestamp);
      }
  };
  
  const resetSessionScores = () => {
    if (!currentSession) return;
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0, bonusScore: 0 }));
    setCurrentSession({ ...currentSession, players: resetPlayers, startTime: Date.now(), lastUpdatedAt: Date.now() });
  };

  const exitSession = async (overrides?: Partial<GameSession>) => {
      if (!currentSession) return;

      const sessionToSave = { ...currentSession, ...overrides };

      const hasScores = sessionToSave.players.some(p => 
          Object.keys(p.scores).length > 0 || 
          (p.bonusScore || 0) !== 0 ||
          p.tieBreaker ||
          p.isForceLost ||
          p.isStarter 
      );

      const hasCustomPlayers = sessionToSave.players.some(p => {
          // Check 1: Has Linked Identity (Name changed or selected from history)
          if (p.linkedPlayerId) return true;
          
          // Check 2: Has Custom ID (Not a system default ID)
          const isSystemId = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
          return !isSystemId;
      });

      const hasPhotos = (sessionToSave.photos && sessionToSave.photos.length > 0);
      const hasLocation = !!sessionToSave.location;
      
      const hasDataToSave = hasScores || hasPhotos || hasCustomPlayers || hasLocation;

      if (!hasDataToSave) {
          // [Empty Exit Cleanup]
          cleanupService.cleanSessionArtifacts(sessionToSave.id, sessionToSave.cloudFolderId).catch(console.error);
          db.sessions.delete(sessionToSave.id).catch(console.error);

          // [Cleanup Logic] Auto-cleanup disposable template
          if (activeTemplate) {
              await cleanupService.cleanupDisposableTemplate(activeTemplate.id);
          }
      } else {
          const finalSession = { ...sessionToSave, lastUpdatedAt: Date.now() };
          await db.sessions.put(finalSession);
          
          if (isCloudEnabled()) {
              const backgroundCloudBackup = async () => {
                  let folderId = finalSession.cloudFolderId;
                  // [Identity Upgrade] Use session.name for folder name
                  const folderName = finalSession.name || activeTemplate?.name || "Unknown Game";
                  
                  if (!folderId) {
                      folderId = await googleDriveService.createActiveSessionFolder(folderName, finalSession.id);
                      await db.sessions.update(finalSession.id, { cloudFolderId: folderId });
                  }

                  if (folderId) {
                      await googleDriveService.backupActiveSession(finalSession, folderName, folderId);
                  }
              };
              backgroundCloudBackup().catch(e => console.warn("Background session backup failed", e));
          }
      }

      const isPureBuiltin = !!(await db.builtins.get(activeTemplate!.id)) && !activeTemplate!.sourceTemplateId;
      
      // [Filter Logic] Check if disposable before backing up template
      if (activeTemplate && !isPureBuiltin && isCloudEnabled() && isImageDirtyRef.current && !isDisposableTemplate(activeTemplate)) {
          googleDriveService.backupTemplate(activeTemplate).then((updated) => {
              if (updated) {
                  db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
              }
          }).catch(console.error);
      }

      setCurrentSession(null); 
      setActiveTemplate(null); 
      setSessionImage(null); 
      isImageDirtyRef.current = false;
  };

  const saveToHistory = async (finalLocation?: string) => {
      if (!currentSession || !activeTemplate) return;
      try {
          const effectiveLocation = finalLocation !== undefined ? finalLocation : currentSession.location;
          const trimmedLoc = effectiveLocation?.trim();

          const rule = currentSession.scoringRule || 'HIGHEST_WINS';
          
          // [Refactor] Use shared calculation logic
          const winnerIds = calculateWinners(currentSession.players, rule);

          // [Optimization] If the template is disposable (simple mode), we don't need to store the snapshot structure.
          const snapshotTemplate = isDisposableTemplate(activeTemplate) 
            ? undefined 
            : JSON.parse(JSON.stringify(activeTemplate));

          const now = Date.now();
          const record: HistoryRecord = {
              id: currentSession.id, 
              templateId: activeTemplate.id,
              
              // [Identity Upgrade] Use Session as source of truth for name/BGG
              gameName: currentSession.name || activeTemplate.name,
              bggId: currentSession.bggId || activeTemplate.bggId, 
              
              startTime: currentSession.startTime,
              endTime: now,
              updatedAt: now, 
              players: currentSession.players,
              winnerIds: winnerIds,
              snapshotTemplate: snapshotTemplate as any, 
              location: trimmedLoc, 
              locationId: currentSession.locationId, 
              note: '',
              photos: currentSession.photos || [],
              cloudFolderId: currentSession.cloudFolderId,
              scoringRule: rule
          };
          
          await db.history.put(record); 
          await db.sessions.delete(currentSession.id);

          try {
              await relationshipService.processGameEnd(record);
          } catch (relError) {
              console.warn("[SessionManager] Relationship processing failed:", relError);
          }

          if (isCloudEnabled()) {
              const backgroundHistoryBackup = async () => {
                  let folderId = record.cloudFolderId;
                  if (!folderId) {
                      folderId = await googleDriveService.createActiveSessionFolder(record.gameName, currentSession.id);
                      await db.history.update(record.id, { cloudFolderId: folderId });
                  }
                  
                  if (folderId) {
                      await googleDriveService.backupHistoryRecord(record, folderId);
                      await googleDriveService.moveSessionToHistory(folderId);
                  }
              };
              backgroundHistoryBackup().catch(e => console.warn("Background history backup failed", e));
          }

          // [Cleanup Logic] Auto-cleanup disposable templates after saving history
          if (activeTemplate) {
              await cleanupService.cleanupDisposableTemplate(activeTemplate.id);
          }
          
          setCurrentSession(null); 
          setActiveTemplate(null); 
          setSessionImage(null); 
          isImageDirtyRef.current = false;
          
          showToast({ message: "遊戲紀錄已儲存！", type: 'success' });

      } catch (error) {
          console.error("Save to history failed:", error);
          showToast({ message: "儲存失敗，請重試", type: 'error' });
      }
  };

  const updateActiveTemplate = async (updatedTemplate: GameTemplate) => {
      // [Refactor] Use shared preparation logic (handles built-in fork)
      const finalTemplate = await prepareTemplateForSave(
          { ...updatedTemplate, updatedAt: Date.now() }, 
          async (id) => !!(await db.builtins.get(id))
      );

      await db.templates.put(finalTemplate);
      
      // Update session references if ID changed (Forked)
      if (finalTemplate.id !== updatedTemplate.id) {
          if (currentSession) {
              const newSession = { ...currentSession, templateId: finalTemplate.id, lastUpdatedAt: Date.now() };
              const updatedPlayers = newSession.players.map(player => ({ 
                  ...player, totalScore: calculatePlayerTotal(player, finalTemplate, newSession.players) 
              }));
              setCurrentSession({ ...newSession, players: updatedPlayers });
          }
      } else {
          // Standard Update
          if (currentSession) {
              const updatedPlayers = currentSession.players.map(player => ({ 
                  ...player, totalScore: calculatePlayerTotal(player, finalTemplate, currentSession.players) 
              }));
              
              // [Identity Upgrade] Sync changes to Session
              const sessionWithSync = {
                  ...currentSession,
                  name: finalTemplate.name,
                  bggId: finalTemplate.bggId,
                  players: updatedPlayers,
                  lastUpdatedAt: Date.now()
              };
              
              setCurrentSession(sessionWithSync);
          }
      }

      setActiveTemplate(finalTemplate);

      // [Filter Logic] Check if disposable before backing up
      if (isCloudEnabled() && !isDisposableTemplate(finalTemplate)) {
          googleDriveService.backupTemplate(finalTemplate).then((updated) => {
              if (updated) {
                  db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
              }
          }).catch(console.error);
      }
  };

  const handleUpdateSessionImage = async (imgBlobOrUrl: string | Blob | null) => {
      if (!activeTemplate || !imgBlobOrUrl) {
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
      setSessionImage: handleUpdateSessionImage,
      updateSavedPlayer: updatePlayer // Renamed to ensure clarity
  };
};
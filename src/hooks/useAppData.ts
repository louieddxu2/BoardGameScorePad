
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, Player, ScoringRule, TemplatePreference, HistoryRecord } from '../types';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';
import { generateId } from '../utils/idGenerator';
import { googleDriveService } from '../services/googleDrive';
import { useToast } from './useToast';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';

export const useAppData = () => {
  const { showToast } = useToast();
  const [isDbReady, setIsDbReady] = useState(false);
  
  // [Search State]
  const [searchQuery, setSearchQuery] = useState('');

  // [System Dirty Tracking] - Timestamp of last modification to system data
  const [systemDirtyTime, setSystemDirtyTime] = useState<number>(0);
  const markSystemDirty = () => setSystemDirtyTime(Date.now());

  // --- 1. Initialization & Migration ---
  useEffect(() => {
    const init = async () => {
      await migrateFromLocalStorage();
      setIsDbReady(true);
    };
    init();
  }, []);

  // --- 2. Reactive Data Source (Dexie) ---
  
  // Fetch Preferences separately
  const allPrefs = useLiveQuery(() => db.templatePrefs.toArray(), [], []);
  
  const prefsMap = useMemo(() => {
      const map: Record<string, TemplatePreference> = {};
      allPrefs?.forEach(p => { map[p.templateId] = p; });
      return map;
  }, [allPrefs]);

  // Helper to merge prefs into templates (In-Memory)
  const mergePrefs = useCallback((template: GameTemplate, prefsMap: Record<string, TemplatePreference>) => {
      const pref = prefsMap[template.id];
      if (!pref) return template;
      return {
          ...template,
          lastPlayerCount: pref.lastPlayerCount ?? template.lastPlayerCount,
          defaultScoringRule: pref.defaultScoringRule ?? template.defaultScoringRule
      };
  }, []);

  // A. User Templates (DB Search + Count + Limit)
  const userTemplatesData = useLiveQuery(async () => {
      let collection = db.templates.orderBy('updatedAt').reverse();
      
      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(t => t.name.toLowerCase().includes(lowerQ));
      }

      const count = await collection.count();
      const items = await collection.limit(100).toArray(list => list.map(t => ({
         id: t.id, 
         name: t.name, 
         updatedAt: t.updatedAt, 
         createdAt: t.createdAt,
         isPinned: t.isPinned,
         hasImage: t.hasImage, 
         cloudImageId: t.cloudImageId,
         lastSyncedAt: t.lastSyncedAt,
         description: t.description,
         columns: [], 
         globalVisuals: undefined,
         lastPlayerCount: t.lastPlayerCount,
         defaultScoringRule: t.defaultScoringRule
      } as GameTemplate)));

      return { count, items };
  }, [searchQuery], { count: 0, items: [] });

  const userTemplates = useMemo(() => {
      return userTemplatesData.items.map(t => mergePrefs(t, prefsMap));
  }, [userTemplatesData.items, prefsMap, mergePrefs]);
  
  // B. Built-in Templates (DB Search + Count + Limit)
  // [Unified Logic] Apply DB filtering to builtins as requested
  const builtinsData = useLiveQuery(async () => {
      let collection = db.builtins.toCollection(); // Default order
      
      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(t => t.name.toLowerCase().includes(lowerQ));
      }
      
      const count = await collection.count();
      const items = await collection.limit(100).toArray();
      
      return { count, items };
  }, [searchQuery], { count: 0, items: [] });

  // C. System Overrides (Fetch All Shallow)
  // We need overrides to merge into the displayed builtins
  const rawDbOverrides = useLiveQuery(async () => {
      return await db.systemOverrides.toArray(list => list.map(t => ({
         id: t.id, 
         name: t.name, 
         updatedAt: t.updatedAt, 
         createdAt: t.createdAt,
         isPinned: t.isPinned,
         hasImage: t.hasImage, 
         cloudImageId: t.cloudImageId,
         lastSyncedAt: t.lastSyncedAt,
         columns: [], 
         globalVisuals: undefined
      } as GameTemplate)));
  }, [], []);
  
  // D. Active Sessions
  const activeSessions = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), [], []);
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  // E. History Records (DB Search + Count + Limit 100)
  const historyData = useLiveQuery(async () => {
      let collection = db.history.orderBy('endTime').reverse();

      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(h => 
              h.gameName.toLowerCase().includes(lowerQ) ||
              h.players.some(p => p.name.toLowerCase().includes(lowerQ))
          );
      }

      const count = await collection.count();
      const items = await collection.limit(100).toArray();

      return { count, items };
  }, [searchQuery], { count: 0, items: [] });

  // F. Saved Lists (Limit 50)
  const savedPlayers = useLiveQuery(() => db.savedPlayers.orderBy('lastUsed').reverse().limit(50).toArray(), [], []);
  const savedLocations = useLiveQuery(() => db.savedLocations.orderBy('lastUsed').reverse().limit(50).toArray(), [], []);

  const playerHistory = useMemo(() => savedPlayers?.map(p => p.name) || [], [savedPlayers]);
  const locationHistory = useMemo(() => savedLocations?.map(l => l.name) || [], [savedLocations]);

  // System Overrides Map
  const systemOverrides = useMemo(() => {
    const map: Record<string, GameTemplate> = {};
    rawDbOverrides?.forEach(t => { map[t.id] = mergePrefs(t, prefsMap); });
    return map;
  }, [rawDbOverrides, prefsMap, mergePrefs]);

  // Combined System Templates
  const systemTemplates = useMemo(() => {
    return builtinsData.items.map(dt => {
      if (systemOverrides[dt.id]) return systemOverrides[dt.id];
      return mergePrefs(dt, prefsMap);
    });
  }, [builtinsData.items, systemOverrides, prefsMap, mergePrefs]);

  const templates = useMemo(() => userTemplates || [], [userTemplates]);

  // --- 3. LocalStorage Settings ---
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => 
      (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );
  
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_new_badge_ids') || '[]'); } catch { return []; }
  });

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_pinned_ids') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds)); }, [newBadgeIds]);
  useEffect(() => { 
      localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
      // Pins are system config, mark dirty
      // Note: We check if pinnedIds actually changed in togglePin to avoid loop on mount
  }, [pinnedIds]);
  
  useEffect(() => { 
      localStorage.setItem('app_theme', themeMode);
      document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
      setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
      markSystemDirty();
  };

  const togglePin = (id: string) => {
      setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev]);
      markSystemDirty();
  };

  const clearNewBadges = () => { 
      setNewBadgeIds([]); 
      markSystemDirty(); // [Bug Fix] Mark dirty to sync read status
  };

  // --- List Management Actions ---
  const updatePlayerHistory = useCallback((name: string) => {
      if (!name.trim()) return;
      const cleanName = name.trim();
      (db as any).transaction('rw', db.savedPlayers, async () => {
          const existing = await db.savedPlayers.where('name').equals(cleanName).first();
          if (existing) {
              await db.savedPlayers.update(existing.id!, { lastUsed: Date.now(), usageCount: (existing.usageCount || 0) + 1 });
          } else {
              await db.savedPlayers.add({ name: cleanName, lastUsed: Date.now(), usageCount: 1 });
          }
      }).then(() => {
          markSystemDirty();
      }).catch(console.error);
  }, []);

  const updateLocationHistory = useCallback((name: string) => {
      if (!name.trim()) return;
      const cleanName = name.trim();
      (db as any).transaction('rw', db.savedLocations, async () => {
          const existing = await db.savedLocations.where('name').equals(cleanName).first();
          if (existing) {
              await db.savedLocations.update(existing.id!, { lastUsed: Date.now(), usageCount: (existing.usageCount || 0) + 1 });
          } else {
              await db.savedLocations.add({ name: cleanName, lastUsed: Date.now(), usageCount: 1 });
          }
      }).then(() => {
          markSystemDirty();
      }).catch(console.error);
  }, []);

  // --- 4. Active Session Management ---
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  const isImageDirtyRef = useRef(false);
  const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);
  
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<HistoryRecord | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentSession) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        db.sessions.put(currentSession).catch(err => console.error("Failed to autosave:", err));
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currentSession]);

  // Helper: Check if cloud features are enabled
  const isCloudEnabled = () => {
      return localStorage.getItem('google_drive_auto_connect') === 'true' && googleDriveService.isAuthorized;
  };

  // --- Actions ---
  const getTemplate = async (id: string): Promise<GameTemplate | null> => {
      let t = await db.templates.get(id);
      if (t) return mergePrefs(t, prefsMap);
      t = await db.systemOverrides.get(id);
      if (t) return mergePrefs(t, prefsMap);
      t = await db.builtins.get(id);
      if (t) return mergePrefs(t, prefsMap);
      return null;
  };

  const saveTemplate = async (template: GameTemplate, options: { skipCloud?: boolean } = {}) => {
    const migratedTemplate = migrateTemplate({ ...template, updatedAt: Date.now() });
    const isSystem = !!(await db.builtins.get(migratedTemplate.id));
    if (isSystem) {
        await db.systemOverrides.put(migratedTemplate);
    } else {
        await db.templates.put(migratedTemplate);
    }
    // 注意：這裡保留對模板的單獨備份邏輯，因應使用者的「備份」按鈕需求
    if (!options.skipCloud && isCloudEnabled() && !isSystem) {
        googleDriveService.backupTemplate(migratedTemplate).then((updated) => {
            db.templates.update(updated.id, { lastSyncedAt: Date.now() });
        }).catch(console.error);
    }
  };

  const deleteTemplate = async (id: string) => {
      const templateToDelete = await getTemplate(id); 
      await db.templates.delete(id);
      const relatedSessions = await db.sessions.where('templateId').equals(id).toArray();
      if (relatedSessions.length > 0) { await db.sessions.bulkDelete(relatedSessions.map(s => s.id)); }
      await db.templatePrefs.delete(id);
      if (isCloudEnabled() && templateToDelete) {
          // [Changed] Use strict type 'template'
          googleDriveService.softDeleteFolder(id, 'template').then(() => {
              showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
          }).catch(console.error);
      }
  };

  const restoreSystemTemplate = async (templateId: string) => {
      // [Bug Fix] Clean up cloud backup of the override if exists
      const overrideToDelete = await db.systemOverrides.get(templateId);
      
      await db.systemOverrides.delete(templateId);
      await db.templatePrefs.delete(templateId);
      
      if (isCloudEnabled() && overrideToDelete) {
          // [Changed] Use strict type 'template'
          googleDriveService.softDeleteFolder(overrideToDelete.id, 'template').catch(console.error);
      }
  };

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
    // [Optimization] Lazy Creation: We do NOT create the cloud folder here to prevent UI freeze.
    // The folder will be created on-demand when the user exits session, uploads a photo, or finishes the game.

    const newSession: GameSession = { 
        id: sessionId, 
        templateId: migratedTemplate.id, 
        startTime: startTime, 
        players: players, 
        status: 'active',
        scoringRule: scoringRule,
        cloudFolderId: undefined // Intentionally undefined
    };
    
    isImageDirtyRef.current = false;
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
              setActiveTemplate(template);
              setCurrentSession(session);
              return true;
          }
      } catch (e) { console.error("Failed to resume session", e); }
      return false;
  };

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  const discardSession = async (templateId: string) => {
      const session = activeSessions?.find(s => s.templateId === templateId);
      if (session) {
          // [Bug Fix] Scenario 5: Sync delete from cloud when discarding active session
          // [Correction] Move to Trash instead of hard delete
          if (session.cloudFolderId && isCloudEnabled()) {
              // [Changed] Use strict type 'active'
              googleDriveService.softDeleteFolder(session.cloudFolderId, 'active').catch(console.error);
          }
          await db.sessions.delete(session.id);
      }
      if (currentSession?.templateId === templateId) { setCurrentSession(null); setActiveTemplate(null); }
  };

  const clearAllActiveSessions = async () => {
      const activeIds = activeSessions?.map(s => s.id) || [];
      if (activeIds.length > 0) {
          // [Feature] Cloud Sync: Move all existing cloud folders to trash
          // This runs in background to avoid blocking UI
          if (isCloudEnabled() && activeSessions) {
              const cloudRemovals = activeSessions
                  .filter(s => s.cloudFolderId)
                  // [Changed] Use strict type 'active'
                  .map(s => googleDriveService.softDeleteFolder(s.cloudFolderId!, 'active'));
              
              if (cloudRemovals.length > 0) {
                  Promise.all(cloudRemovals).catch(e => console.error("Cloud batch trash failed", e));
              }
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
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0 }));
    setCurrentSession({ ...currentSession, players: resetPlayers, startTime: Date.now() });
  };

  const exitSession = async () => {
      if (!currentSession) return;

      const hasScores = currentSession.players.some(p => Object.keys(p.scores).length > 0);

      // [Bug Fix] "Empty Exit" Logic
      // Check if session is empty BEFORE attempting any cloud creation.
      if (!hasScores) {
          // If the session is empty, we discard it.
          // If it happened to have a cloud folder (e.g. user took a photo then deleted all scores), clean it up.
          // [Correction] Move to Trash instead of hard delete
          if (currentSession.cloudFolderId && isCloudEnabled()) {
              // [Changed] Use strict type 'active'
              googleDriveService.softDeleteFolder(currentSession.cloudFolderId, 'active').catch(console.error);
          }
          await db.sessions.delete(currentSession.id);
      } else {
          // Session has data, save normally.
          await db.sessions.put(currentSession);
          
          // [Cloud Trigger 3a] Exit Session (Pause) -> Upload Score JSON
          if (isCloudEnabled()) {
              // If we have a folder ID, upload. If not, try to find/create it first.
              let folderId = currentSession.cloudFolderId;
              if (!folderId && activeTemplate) {
                  folderId = await googleDriveService.createActiveSessionFolder(activeTemplate.name, currentSession.id);
                  // Update session with new folder ID
                  await db.sessions.update(currentSession.id, { cloudFolderId: folderId });
              }

              if (folderId) {
                  const sessionData = JSON.stringify(currentSession, null, 2);
                  googleDriveService.uploadFileToFolder(folderId, 'session.json', 'application/json', sessionData)
                      .catch(e => console.error("Failed to sync session json on exit", e));
              }
          }
      }

      // Legacy auto-connect logic for templates: Only sync if explicitly dirtied image or not system
      const isSystem = activeTemplate && !!(await db.builtins.get(activeTemplate.id));
      if (activeTemplate && !isSystem && isCloudEnabled() && isImageDirtyRef.current) {
          const imageToUpload = sessionImage; // Only if template image changed
          // This handles TEMPLATE backup, not session
          googleDriveService.backupTemplate(activeTemplate, imageToUpload).then((updated) => {
              db.templates.update(updated.id, { lastSyncedAt: Date.now() });
          }).catch(console.error);
      }

      setCurrentSession(null); setActiveTemplate(null); setSessionImage(null); isImageDirtyRef.current = false;
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
              cloudFolderId: currentSession.cloudFolderId // Inherit Cloud Folder ID
          };
          
          await db.history.put(record); 
          
          currentSession.players.forEach(p => { updatePlayerHistory(p.name); });
          await db.sessions.delete(currentSession.id);

          // [Cloud Trigger 3b] Save History -> Move Folder to _History
          if (isCloudEnabled()) {
              let folderId = record.cloudFolderId;
              if (!folderId) {
                  // If playing offline or lazy creation was pending, create folder now
                  folderId = await googleDriveService.createActiveSessionFolder(activeTemplate.name, currentSession.id);
                  // Update record with folder ID
                  await db.history.update(record.id, { cloudFolderId: folderId });
              }
              
              if (folderId) {
                  // First, save the FINAL session.json state into the folder before moving
                  // This ensures the history folder contains the final score data
                  const sessionData = JSON.stringify(record, null, 2);
                  await googleDriveService.uploadFileToFolder(folderId, 'session.json', 'application/json', sessionData);
                  
                  // Then move
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

  const deleteHistoryRecord = async (id: string) => { 
      try {
          // Fetch record to check for cloud link
          const record = await db.history.get(id);
          await db.history.delete(id);
          
          // [Changed] Use strict type 'history'
          if (isCloudEnabled() && record?.cloudFolderId) {
              googleDriveService.softDeleteFolder(record.cloudFolderId, 'history').catch(console.error);
          }

          showToast({ message: "紀錄已刪除", type: 'info' });
      } catch (error) {
          console.error("Failed to delete history:", error);
          showToast({ message: "刪除失敗", type: 'error' });
      }
  };
  
  const viewHistory = (record: HistoryRecord | null) => { setViewingHistoryRecord(record); };

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

  const handleUpdateSessionImage = (img: string | null) => {
      setSessionImage(img);
      if (img) isImageDirtyRef.current = true;
  };

  // --- Export System Data for Backup (Including Templates, Overrides, History, Sessions) ---
  const getSystemExportData = async () => {
      const players = await db.savedPlayers.toArray();
      const locations = await db.savedLocations.toArray();
      const customTemplates = await db.templates.toArray();
      const overrides = await db.systemOverrides.toArray();
      const history = await db.history.toArray();
      const activeSessions = await db.sessions.toArray(); // [New] Fetch Active Sessions
      
      return {
          preferences: {
              theme: themeMode,
              pinnedIds,
              newBadgeIds, 
              zoomLevel: parseFloat(localStorage.getItem('app_zoom_level') || '1.0'),
              isEditMode: localStorage.getItem('app_edit_mode') !== 'false'
          },
          library: {
              players,
              locations
          },
          // Include data for Full Backup
          data: {
              templates: customTemplates,
              overrides: overrides,
              history: history,
              sessions: activeSessions // [New]
          },
          timestamp: Date.now()
      };
  };

  // [New] Import Session from Cloud
  const importSession = async (session: GameSession) => {
      try {
          // Put the session directly into DB.
          await db.sessions.put(session);
          showToast({ message: "遊戲進度已匯入", type: 'success' });
      } catch (e) {
          console.error("Failed to import session", e);
          showToast({ message: "匯入失敗", type: 'error' });
      }
  };

  // [New] Import History Record from Cloud
  const importHistoryRecord = async (record: HistoryRecord) => {
      try {
          // Put the record directly into DB.
          await db.history.put(record);
          showToast({ message: "歷史紀錄已還原", type: 'success' });
      } catch (e) {
          console.error("Failed to import history", e);
          showToast({ message: "還原失敗", type: 'error' });
      }
  };

  return { 
      // State
      searchQuery,
      
      // Data
      templates, 
      userTemplatesCount: userTemplatesData.count,
      
      systemTemplates, 
      systemTemplatesCount: builtinsData.count,
      systemOverrides,
      
      activeSessionIds, 
      newBadgeIds, 
      pinnedIds, 
      playerHistory, 
      locationHistory,
      
      historyRecords: historyData.items,
      historyCount: historyData.count,
      
      currentSession, activeTemplate, sessionImage, viewingHistoryRecord,
      themeMode, sessionPlayerCount,
      
      // Actions
      setSearchQuery,
      setTemplates: () => {}, 
      setSessionImage: handleUpdateSessionImage, 
      toggleTheme, togglePin, updatePlayerHistory, 
      updateLocationHistory, 
      clearNewBadges,
      
      saveTemplate, deleteTemplate, restoreSystemTemplate,
      getTemplate, 
      
      startSession, updateSession, resetSessionScores, exitSession, 
      resumeSession, discardSession, clearAllActiveSessions, getSessionPreview,
      
      saveToHistory, deleteHistoryRecord, viewHistory,
      updateActiveTemplate,
      
      // System Backup Helpers
      systemDirtyTime,
      getSystemExportData,
      importSession,
      importHistoryRecord, 
      
      isDbReady 
  };
};

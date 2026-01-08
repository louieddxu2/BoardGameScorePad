
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, Player, ScoringRule, TemplatePreference, HistoryRecord } from '../types';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';
import { generateId } from '../utils/idGenerator';
import { googleDriveService } from '../services/googleDrive';
import { imageService } from '../services/imageService';
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
      // [Optimization] We strip the heavy 'columns' array but calculate length for UI display
      const items = await collection.limit(100).toArray(list => list.map(t => ({
         id: t.id, 
         name: t.name, 
         updatedAt: t.updatedAt, 
         createdAt: t.createdAt,
         isPinned: t.isPinned,
         hasImage: t.hasImage, 
         imageId: t.imageId, 
         cloudImageId: t.cloudImageId,
         lastSyncedAt: t.lastSyncedAt,
         description: t.description,
         columns: [], // Clear heavy data
         globalVisuals: undefined,
         lastPlayerCount: t.lastPlayerCount,
         defaultScoringRule: t.defaultScoringRule,
         columnCount: t.columns?.length || 0 // Inject metadata for list display
      } as any as GameTemplate)));

      return { count, items };
  }, [searchQuery], { count: 0, items: [] });

  const userTemplates = useMemo(() => {
      return userTemplatesData.items.map(t => mergePrefs(t, prefsMap));
  }, [userTemplatesData.items, prefsMap, mergePrefs]);
  
  // B. Built-in Templates (DB Search + Count + Limit)
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

  // C. System Overrides (Fetch All)
  const rawDbOverrides = useLiveQuery(async () => {
      return await db.systemOverrides.toArray(list => list.map(t => ({
         id: t.id, 
         name: t.name, 
         updatedAt: t.updatedAt, 
         createdAt: t.createdAt,
         isPinned: t.isPinned,
         hasImage: t.hasImage, 
         imageId: t.imageId,
         cloudImageId: t.cloudImageId,
         lastSyncedAt: t.lastSyncedAt,
         columns: [], // Clear heavy data
         globalVisuals: undefined,
         columnCount: t.columns?.length || 0 // Inject metadata
      } as any as GameTemplate)));
  }, [], []);
  
  // D. Active Sessions
  const activeSessions = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), [], []);
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  // E. History Records (DB Search + Count + Limit 100)
  const historyData = useLiveQuery(async () => {
      let collection = db.history.orderBy('endTime').reverse();

      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(h => {
              if (h.gameName.toLowerCase().includes(lowerQ)) return true;
              if (h.players.some(p => p.name.toLowerCase().includes(lowerQ))) return true;
              if (h.location && h.location.toLowerCase().includes(lowerQ)) return true;
              const d = new Date(h.endTime);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const dateKeywords = [`${yyyy}`, `${yyyy}-${mm}`, `${yyyy}/${mm}`, `${yyyy}.${mm}`, `${yyyy}${mm}${dd}`, `${mm}-${dd}`, `${mm}/${dd}`];
              return dateKeywords.some(k => k.includes(lowerQ));
          });
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
      markSystemDirty();
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
  
  // Use a string URL for the UI (created via URL.createObjectURL)
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  
  const isImageDirtyRef = useRef(false);
  const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);
  
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<HistoryRecord | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-revoke Object URL to prevent memory leaks
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
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currentSession]);

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

  const saveTemplate = async (template: GameTemplate, options: { skipCloud?: boolean, preserveTimestamps?: boolean } = {}) => {
    const finalUpdatedAt = options.preserveTimestamps ? (template.updatedAt || Date.now()) : Date.now();
    const migratedTemplate = migrateTemplate({ ...template, updatedAt: finalUpdatedAt });
    
    const isSystem = !!(await db.builtins.get(migratedTemplate.id));
    if (isSystem) {
        await db.systemOverrides.put(migratedTemplate);
    } else {
        await db.templates.put(migratedTemplate);
    }
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
      await imageService.deleteImagesByRelatedId(id);

      if (isCloudEnabled() && templateToDelete) {
          googleDriveService.softDeleteFolder(id, 'template').then(() => {
              showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
          }).catch(console.error);
      }
  };

  const restoreSystemTemplate = async (templateId: string) => {
      const overrideToDelete = await db.systemOverrides.get(templateId);
      await db.systemOverrides.delete(templateId);
      await db.templatePrefs.delete(templateId);
      await imageService.deleteImagesByRelatedId(templateId);

      if (isCloudEnabled() && overrideToDelete) {
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
            // Create a temporary URL for the Blob
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

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  const discardSession = async (templateId: string) => {
      const session = activeSessions?.find(s => s.templateId === templateId);
      if (session) {
          if (session.cloudFolderId && isCloudEnabled()) {
              googleDriveService.softDeleteFolder(session.cloudFolderId, 'active').catch(console.error);
          }
          await db.sessions.delete(session.id);
          await imageService.deleteImagesByRelatedId(session.id);
      }
      if (currentSession?.templateId === templateId) { setCurrentSession(null); setActiveTemplate(null); }
  };

  const clearAllActiveSessions = async () => {
      const activeIds = activeSessions?.map(s => s.id) || [];
      if (activeIds.length > 0) {
          if (isCloudEnabled() && activeSessions) {
              const cloudRemovals = activeSessions
                  .filter(s => s.cloudFolderId)
                  .map(s => googleDriveService.softDeleteFolder(s.cloudFolderId!, 'active'));
              
              if (cloudRemovals.length > 0) {
                  Promise.all(cloudRemovals).catch(e => console.error("Cloud batch trash failed", e));
              }
          }
          await db.sessions.bulkDelete(activeIds);
          for (const sId of activeIds) {
              await imageService.deleteImagesByRelatedId(sId);
          }
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

      if (!hasScores) {
          if (currentSession.cloudFolderId && isCloudEnabled()) {
              googleDriveService.softDeleteFolder(currentSession.cloudFolderId, 'active').catch(console.error);
          }
          await db.sessions.delete(currentSession.id);
          await imageService.deleteImagesByRelatedId(currentSession.id);
      } else {
          await db.sessions.put(currentSession);
          if (isCloudEnabled()) {
              let folderId = currentSession.cloudFolderId;
              if (!folderId && activeTemplate) {
                  folderId = await googleDriveService.createActiveSessionFolder(activeTemplate.name, currentSession.id);
                  await db.sessions.update(currentSession.id, { cloudFolderId: folderId });
              }

              if (folderId) {
                  const sessionData = JSON.stringify(currentSession, null, 2);
                  googleDriveService.uploadFileToFolder(folderId, 'session.json', 'application/json', sessionData)
                      .catch(e => console.error("Failed to sync session json on exit", e));
              }
          }
      }

      const isSystem = activeTemplate && !!(await db.builtins.get(activeTemplate.id));
      if (activeTemplate && !isSystem && isCloudEnabled() && isImageDirtyRef.current) {
          // If template image was updated (Blob exists in DB), trigger backup
          // The imageService holds the blob, we just sync metadata
          googleDriveService.backupTemplate(activeTemplate).then((updated) => {
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
                  const sessionData = JSON.stringify(record, null, 2);
                  await googleDriveService.uploadFileToFolder(folderId, 'session.json', 'application/json', sessionData);
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
          const record = await db.history.get(id);
          await db.history.delete(id);
          await imageService.deleteImagesByRelatedId(id);

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

  // Modified: Save image directly as Blob from the updated `compressAndResizeImage` logic
  const handleUpdateSessionImage = async (imgBlobOrUrl: string | Blob | null) => {
      if (!activeTemplate || !imgBlobOrUrl) {
          setSessionImage(null);
          return;
      }
      
      let blob: Blob;
      
      // Handle different input types (though with new logic, it should mostly be Blob)
      if (typeof imgBlobOrUrl === 'string') {
          // Fallback if still passing DataURL (unlikely with new code)
          blob = imageService.base64ToBlob(imgBlobOrUrl);
      } else {
          blob = imgBlobOrUrl;
      }

      isImageDirtyRef.current = true;
      
      // Save directly
      const savedImg = await imageService.saveImage(blob, activeTemplate.id, 'template');
      
      // Update UI with an Object URL
      if (sessionImage) URL.revokeObjectURL(sessionImage);
      setSessionImage(URL.createObjectURL(blob));

      // Update Template with ID
      const updatedT = { ...activeTemplate, imageId: savedImg.id, hasImage: true };
      updateActiveTemplate(updatedT); 
  };

  // --- Export System Data ---
  const getSystemExportData = async () => {
      const players = await db.savedPlayers.toArray();
      const locations = await db.savedLocations.toArray();
      const customTemplates = await db.templates.toArray();
      const overrides = await db.systemOverrides.toArray();
      const history = await db.history.toArray();
      const activeSessions = await db.sessions.toArray(); 
      
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
          data: {
              templates: customTemplates,
              overrides: overrides,
              history: history,
              sessions: activeSessions
          },
          timestamp: Date.now()
      };
  };

  const importSystemSettings = async (settings: any) => {
      try {
          if (settings.preferences) {
              const { theme, pinnedIds, newBadgeIds, zoomLevel, isEditMode } = settings.preferences;
              if (theme) {
                  setThemeMode(theme);
                  localStorage.setItem('app_theme', theme);
              }
              if (pinnedIds) {
                  setPinnedIds(pinnedIds);
                  localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
              }
              if (newBadgeIds) {
                  setNewBadgeIds(newBadgeIds);
                  localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds));
              }
              if (zoomLevel) localStorage.setItem('app_zoom_level', String(zoomLevel));
              if (isEditMode !== undefined) localStorage.setItem('app_edit_mode', String(isEditMode));
          }

          if (settings.library) {
              if (Array.isArray(settings.library.players)) {
                  await db.savedPlayers.bulkPut(settings.library.players);
              }
              if (Array.isArray(settings.library.locations)) {
                  await db.savedLocations.bulkPut(settings.library.locations);
              }
          }
          console.log("System settings restored successfully");
      } catch (e) {
          console.error("Failed to restore settings", e);
      }
  };

  const importSession = async (session: GameSession) => {
      try {
          await db.sessions.put(session);
          showToast({ message: "遊戲進度已匯入", type: 'success' });
      } catch (e) {
          console.error("Failed to import session", e);
          showToast({ message: "匯入失敗", type: 'error' });
      }
  };

  const importHistoryRecord = async (record: HistoryRecord) => {
      try {
          await db.history.put(record);
          showToast({ message: "歷史紀錄已還原", type: 'success' });
      } catch (e) {
          console.error("Failed to import history", e);
          showToast({ message: "還原失敗", type: 'error' });
      }
  };
  
  const saveImage = async (blob: Blob, relatedId: string, type: 'template' | 'session') => {
      return await imageService.saveImage(blob, relatedId, type);
  };
  
  const loadImage = async (id: string) => {
      return await imageService.getImage(id);
  };

  return { 
      searchQuery,
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
      setSearchQuery,
      setTemplates: () => {}, 
      setSessionImage: handleUpdateSessionImage, // Use new handler
      toggleTheme, togglePin, updatePlayerHistory, 
      updateLocationHistory, 
      clearNewBadges,
      saveTemplate, deleteTemplate, restoreSystemTemplate,
      getTemplate, 
      startSession, updateSession, resetSessionScores, exitSession, 
      resumeSession, discardSession, clearAllActiveSessions, getSessionPreview,
      saveToHistory, deleteHistoryRecord, viewHistory,
      updateActiveTemplate,
      saveImage, loadImage,
      systemDirtyTime,
      getSystemExportData,
      importSystemSettings, 
      importSession,
      importHistoryRecord, 
      isDbReady 
  };
};

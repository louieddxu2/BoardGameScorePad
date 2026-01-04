
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, Player, ScoringRule, TemplatePreference } from '../types';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';
import { generateId } from '../utils/idGenerator';
import { googleDriveService } from '../services/googleDrive';
import { useToast } from './useToast';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';

export const useAppData = () => {
  const { showToast } = useToast();
  const [isDbReady, setIsDbReady] = useState(false);

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

  // [Shallow Fetching]: Only fetch metadata for the list to save memory
  const rawUserTemplates = useLiveQuery(async () => {
      // Use toArray with a mapper to avoid loading full objects (especially images/columns)
      return await db.templates.orderBy('updatedAt').toArray(list => list.map(t => ({
         id: t.id, 
         name: t.name, 
         updatedAt: t.updatedAt, 
         createdAt: t.createdAt,
         isPinned: t.isPinned,
         hasImage: t.hasImage, 
         cloudImageId: t.cloudImageId,
         lastSyncedAt: t.lastSyncedAt,
         description: t.description,
         // Metadata only: Empty complex fields
         columns: [], 
         globalVisuals: undefined,
         lastPlayerCount: t.lastPlayerCount,
         defaultScoringRule: t.defaultScoringRule
      } as GameTemplate)));
  }, [], []);

  const userTemplates = useMemo(() => {
      if (!rawUserTemplates) return [];
      return rawUserTemplates.map(t => mergePrefs(t, prefsMap)).reverse(); // Reverse here to show newest first
  }, [rawUserTemplates, prefsMap, mergePrefs]);
  
  // B. 內建模板 (從 DB 讀取 - 內建模板通常不大，但為了統一也做 shallow)
  const rawBuiltinTemplates = useLiveQuery(async () => {
      return await db.builtins.toArray();
  }, [], []);

  // C. 系統覆寫 (Shallow)
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
  
  // D. 進行中的 Session
  const activeSessions = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), [], []);
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  // System Overrides Map
  const systemOverrides = useMemo(() => {
    const map: Record<string, GameTemplate> = {};
    rawDbOverrides?.forEach(t => { map[t.id] = mergePrefs(t, prefsMap); });
    return map;
  }, [rawDbOverrides, prefsMap, mergePrefs]);

  // Combined System Templates (Built-in Base + Overrides)
  const systemTemplates = useMemo(() => {
    if (!rawBuiltinTemplates) return [];
    return rawBuiltinTemplates.map(dt => {
      // If override exists, use it (prefs already merged in systemOverrides memo)
      // Note: If override exists, it's shallow. We rely on startSession to fetch full.
      if (systemOverrides[dt.id]) return systemOverrides[dt.id];
      // Otherwise merge prefs into base builtin
      return mergePrefs(dt, prefsMap);
    });
  }, [rawBuiltinTemplates, systemOverrides, prefsMap, mergePrefs]);

  const templates = useMemo(() => userTemplates || [], [userTemplates]);

  // --- 3. LocalStorage Settings (Lightweight config) ---
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => 
      (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );
  
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_new_badge_ids') || '[]'); } catch { return []; }
  });

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_pinned_ids') || '[]'); } catch { return []; }
  });

  const [playerHistory, setPlayerHistory] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_player_history') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds)); }, [newBadgeIds]);
  useEffect(() => { localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds)); }, [pinnedIds]);
  useEffect(() => { localStorage.setItem('sm_player_history', JSON.stringify(playerHistory)); }, [playerHistory]);
  
  useEffect(() => { 
      localStorage.setItem('app_theme', themeMode);
      document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
  const togglePin = (id: string) => setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev]);
  const updatePlayerHistory = (newName: string) => {
      if (!newName.trim()) return;
      const cleanName = newName.trim();
      setPlayerHistory(prev => [cleanName, ...prev.filter(n => n !== cleanName)].slice(0, 20));
  };
  
  const clearNewBadges = () => {
      setNewBadgeIds([]);
  };

  // --- 4. Active Session Management ---
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  const isImageDirtyRef = useRef(false);
  const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentSession) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        db.sessions.put(currentSession).catch(err => console.error("Failed to autosave:", err));
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currentSession]);

  // --- Actions ---

  // Helper: Fetch full template from DB (since lists are shallow)
  const getTemplate = async (id: string): Promise<GameTemplate | null> => {
      // 1. Try User Templates
      let t = await db.templates.get(id);
      if (t) return mergePrefs(t, prefsMap);

      // 2. Try System Overrides
      t = await db.systemOverrides.get(id);
      if (t) return mergePrefs(t, prefsMap);

      // 3. Try Builtins
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

    if (!options.skipCloud && googleDriveService.isAuthorized && !isSystem) {
        googleDriveService.backupTemplate(migratedTemplate).then((updated) => {
            db.templates.update(updated.id, { lastSyncedAt: Date.now() });
        }).catch(console.error);
    }
  };

  const deleteTemplate = async (id: string) => {
      const templateToDelete = await getTemplate(id); // Fetch full for backup name if needed
      await db.templates.delete(id);
      
      const relatedSessions = await db.sessions.where('templateId').equals(id).toArray();
      if (relatedSessions.length > 0) {
          await db.sessions.bulkDelete(relatedSessions.map(s => s.id));
      }
      
      await db.templatePrefs.delete(id);

      if (googleDriveService.isAuthorized && templateToDelete) {
          googleDriveService.softDeleteFolder(id, templateToDelete.name).then(() => {
              showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
          }).catch(console.error);
      }
  };

  const restoreSystemTemplate = async (templateId: string) => {
      await db.systemOverrides.delete(templateId);
      await db.templatePrefs.delete(templateId);
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
    } catch (e) {
        console.warn("Failed to save preferences", e);
    }

    // [CRITICAL] Ensure we have the FULL template (with columns) before starting
    const fullTemplate = await getTemplate(partialTemplate.id);
    if (!fullTemplate) {
        showToast({ message: "無法讀取模板資料", type: 'error' });
        return;
    }

    const migratedTemplate = migrateTemplate(fullTemplate);
    
    // Explicitly update prefs again on the in-memory object to be safe
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

    const newSession: GameSession = { 
        id: generateId(), 
        templateId: migratedTemplate.id, 
        startTime: startTime, 
        players: players, 
        status: 'active',
        scoringRule: scoringRule
    };
    
    await db.sessions.put(newSession);

    isImageDirtyRef.current = false;
    setActiveTemplate(migratedTemplate);
    setCurrentSession(newSession);
  };

  const resumeSession = async (templateId: string): Promise<boolean> => {
      try {
          const session = await db.sessions
            .where('templateId').equals(templateId)
            .and(s => s.status === 'active')
            .first();

          if (!session) return false;

          // Fetch full template
          let template = await getTemplate(templateId);

          if (template) {
              template = migrateTemplate(template);
              session.players = session.players.map((p: any) => ({ 
                  ...p, 
                  scores: migrateScores(p.scores, template!) 
              }));
              
              setActiveTemplate(template);
              setCurrentSession(session);
              return true;
          }
      } catch (e) {
          console.error("Failed to resume session", e);
      }
      return false;
  };

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  const discardSession = async (templateId: string) => {
      const session = activeSessions?.find(s => s.templateId === templateId);
      if (session) {
          await db.sessions.delete(session.id);
      }
      if (currentSession?.templateId === templateId) {
          setCurrentSession(null);
          setActiveTemplate(null);
      }
  };

  const clearAllActiveSessions = async () => {
      const activeIds = activeSessions?.map(s => s.id) || [];
      if (activeIds.length > 0) {
          await db.sessions.bulkDelete(activeIds);
      }
  };

  const updateSession = (updatedSession: GameSession) => {
      if (activeTemplate) {
        const playersWithTotal = updatedSession.players.map(p => ({ 
            ...p, 
            totalScore: calculatePlayerTotal(p, activeTemplate, updatedSession.players) 
        }));
        setCurrentSession({ ...updatedSession, players: playersWithTotal });
      } else {
        setCurrentSession(updatedSession);
      }
  };
  
  const resetSessionScores = () => {
    if (!currentSession) return;
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0 }));
    const resetSessionSameId = { ...currentSession, players: resetPlayers, startTime: Date.now() };
    setCurrentSession(resetSessionSameId);
  };

  const exitSession = async () => {
      if (currentSession) {
          await db.sessions.put(currentSession);
      }

      const isSystem = activeTemplate && !!(await db.builtins.get(activeTemplate.id));
      const isAutoConnect = localStorage.getItem('google_drive_auto_connect') === 'true';

      if (activeTemplate && !isSystem && isAutoConnect && googleDriveService.isAuthorized) {
          const imageToUpload = isImageDirtyRef.current ? sessionImage : null;
          googleDriveService.backupTemplate(activeTemplate, imageToUpload).then((updated) => {
              db.templates.update(updated.id, { lastSyncedAt: Date.now() });
          }).catch(console.error);
      }

      if (currentSession) {
          const hasScores = currentSession.players.some(p => Object.keys(p.scores).length > 0);
          if (!hasScores) {
              await db.sessions.delete(currentSession.id);
          }
      }

      setCurrentSession(null);
      setActiveTemplate(null);
      setSessionImage(null);
      isImageDirtyRef.current = false;
  };

  const updateActiveTemplate = async (updatedTemplate: GameTemplate) => {
      const migratedTemplate = migrateTemplate({ ...updatedTemplate, updatedAt: Date.now() });
      setActiveTemplate(migratedTemplate);
      
      const isSystem = !!(await db.builtins.get(migratedTemplate.id));
      
      if (isSystem) {
          await db.systemOverrides.put(migratedTemplate);
      } else {
          await db.templates.put(migratedTemplate);
      }
      
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({ 
              ...player, 
              totalScore: calculatePlayerTotal(player, migratedTemplate, currentSession.players) 
          }));
          setCurrentSession({ ...currentSession, players: updatedPlayers });
      }
  };

  const handleUpdateSessionImage = (img: string | null) => {
      setSessionImage(img);
      if (img) {
          isImageDirtyRef.current = true;
      }
  };

  return { 
      templates, systemTemplates, systemOverrides,
      activeSessionIds, newBadgeIds, pinnedIds, playerHistory,
      currentSession, activeTemplate, sessionImage, 
      themeMode, sessionPlayerCount,
      
      setTemplates: () => {}, 
      setSessionImage: handleUpdateSessionImage, 
      toggleTheme, togglePin, updatePlayerHistory, 
      clearNewBadges,
      
      saveTemplate, deleteTemplate, restoreSystemTemplate,
      getTemplate, // New Export
      
      startSession, updateSession, resetSessionScores, exitSession, 
      resumeSession, discardSession, clearAllActiveSessions, getSessionPreview,
      
      updateActiveTemplate,
      
      isDbReady 
  };
};

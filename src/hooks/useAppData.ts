
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, Player, ScoringRule } from '../types';
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
  
  // A. 使用者自訂模板
  const userTemplates = useLiveQuery(async () => {
      const templates = await db.templates.orderBy('updatedAt').toArray();
      return templates.reverse();
  }, [], []);
  
  // B. 內建模板 (從 DB 讀取)
  const builtinTemplates = useLiveQuery(async () => {
      return await db.builtins.toArray();
  }, [], []);

  // C. 系統覆寫 (使用者修改過的內建模板)
  const dbOverrides = useLiveQuery(() => db.systemOverrides.toArray(), [], []);
  
  // D. 進行中的 Session
  const activeSessions = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), [], []);
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  // System Overrides Map
  const systemOverrides = useMemo(() => {
    const map: Record<string, GameTemplate> = {};
    dbOverrides?.forEach(t => { map[t.id] = t; });
    return map;
  }, [dbOverrides]);

  // Combined System Templates (Built-in Base + Overrides)
  const systemTemplates = useMemo(() => {
    if (!builtinTemplates) return [];
    return builtinTemplates.map(dt => {
      if (systemOverrides[dt.id]) return systemOverrides[dt.id];
      return dt;
    });
  }, [builtinTemplates, systemOverrides]);

  const templates = useMemo(() => userTemplates || [], [userTemplates]);

  // --- 3. LocalStorage Settings (Lightweight config) ---
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => 
      (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );
  
  // [Modified] New Badge IDs: 僅儲存「未讀的新增項目 ID」
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
  
  // [Modified] 清除未讀標記：直接清空 newBadgeIds 即可
  const clearNewBadges = () => {
      setNewBadgeIds([]);
  };

  // --- 4. Active Session Management ---
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  const [sessionImage, setSessionImage] = useState<string | null>(null);
  const isImageDirtyRef = useRef(false);
  
  // [New Feature] Session Player Count Memory (Valid only for current app session)
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

  const saveTemplate = async (template: GameTemplate, options: { skipCloud?: boolean } = {}) => {
    const migratedTemplate = migrateTemplate({ ...template, updatedAt: Date.now() });
    
    // 檢查是否為內建遊戲
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
      const templateToDelete = userTemplates?.find(t => t.id === id);
      await db.templates.delete(id);
      
      const relatedSessions = await db.sessions.where('templateId').equals(id).toArray();
      if (relatedSessions.length > 0) {
          await db.sessions.bulkDelete(relatedSessions.map(s => s.id));
      }

      if (googleDriveService.isAuthorized && templateToDelete) {
          googleDriveService.softDeleteFolder(id, templateToDelete.name).then(() => {
              showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
          }).catch(console.error);
      }
  };

  const restoreSystemTemplate = async (templateId: string) => {
      await db.systemOverrides.delete(templateId);
  };

  const startSession = async (
      template: GameTemplate, 
      playerCount: number, 
      options?: { startTimeStr?: string, scoringRule?: ScoringRule }
  ) => {
    // 1. 更新當次 Session 的記憶
    setSessionPlayerCount(playerCount);

    const scoringRule = options?.scoringRule || 'HIGHEST_WINS';

    // 2. 更新資料庫中的 Template 紀錄 (持久化偏好：人數與計分規則)
    try {
        const updateData: Partial<GameTemplate> = { 
            lastPlayerCount: playerCount,
            defaultScoringRule: scoringRule
        };

        const isUserTemplate = await db.templates.get(template.id);
        if (isUserTemplate) {
            await db.templates.update(template.id, updateData);
        } else {
            // 是內建遊戲：檢查是否有覆寫，若無則建立覆寫以儲存偏好
            const existingOverride = await db.systemOverrides.get(template.id);
            if (existingOverride) {
                await db.systemOverrides.update(template.id, updateData);
            } else {
                // 必須建立一個覆寫來儲存這個 meta data，否則下次就忘了
                await db.systemOverrides.put({ ...template, ...updateData });
            }
        }
    } catch (e) {
        console.warn("Failed to save preferences", e);
    }

    const migratedTemplate = migrateTemplate(template);
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
    
    // Parse start time if provided (format HH:MM)
    let startTime = Date.now();
    if (options?.startTimeStr) {
        const [hours, minutes] = options.startTimeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            const date = new Date();
            date.setHours(hours);
            date.setMinutes(minutes);
            // If the time is in the future, assume it was yesterday (e.g. crossing midnight)
            // But simplified logic: just use today's date with set time.
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

          let template = (await db.templates.get(templateId)) || 
                         (await db.systemOverrides.get(templateId)) || 
                         (await db.builtins.get(templateId));

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
    // Reset time to now as well? Maybe keep original start time. Let's update it to now.
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
      activeSessionIds, newBadgeIds, pinnedIds, playerHistory, // Export newBadgeIds
      currentSession, activeTemplate, sessionImage, 
      themeMode, sessionPlayerCount, // Export sessionPlayerCount
      
      setTemplates: () => {}, 
      setSessionImage: handleUpdateSessionImage, 
      toggleTheme, togglePin, updatePlayerHistory, 
      clearNewBadges, // Export function
      
      saveTemplate, deleteTemplate, restoreSystemTemplate,
      
      startSession, updateSession, resetSessionScores, exitSession, 
      resumeSession, discardSession, clearAllActiveSessions, getSessionPreview,
      
      updateActiveTemplate,
      
      isDbReady 
  };
};

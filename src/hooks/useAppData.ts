
import { useState, useEffect, useMemo, useRef } from 'react';
import { GameTemplate, GameSession, Player, ScoreColumn, ScoreValue, MappingRule, QuickAction, InputMethod } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';
import { generateId } from '../utils/idGenerator';
import { googleDriveService } from '../services/googleDrive';
import { useToast } from './useToast';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';

const loadTemplates = (): GameTemplate[] => {
    try {
        const saved = localStorage.getItem('sm_templates');
        return saved ? JSON.parse(saved).map(migrateTemplate) : [];
    } catch { return []; }
};

const loadOverrides = (): Record<string, GameTemplate> => {
    try {
        const saved = localStorage.getItem('sm_system_overrides');
        const parsed = saved ? JSON.parse(saved) : {};
        Object.keys(parsed).forEach(key => { parsed[key] = migrateTemplate(parsed[key]); });
        return parsed;
    } catch { return {}; }
};

const findTemplateById = (id: string, userTemplates: GameTemplate[], overrides: Record<string, GameTemplate>): GameTemplate | undefined => {
    return userTemplates.find(t => t.id === id) || overrides[id] || DEFAULT_TEMPLATES.find(t => t.id === id);
};

export const useAppData = () => {
  const [templates, setTemplates] = useState<GameTemplate[]>(loadTemplates);
  const [systemOverrides, setSystemOverrides] = useState<Record<string, GameTemplate>>(loadOverrides);
  const { showToast } = useToast();

  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(() => {
      try {
          const savedId = localStorage.getItem('sm_active_template_id');
          if (!savedId) return null;
          const currentTemplates = loadTemplates();
          const currentOverrides = loadOverrides();
          const found = findTemplateById(savedId, currentTemplates, currentOverrides);
          return found ? migrateTemplate(found) : null;
      } catch { return null; }
  });

  const [currentSession, setCurrentSession] = useState<GameSession | null>(() => {
      try {
          const savedSessionStr = localStorage.getItem('sm_current_session');
          const savedTemplateId = localStorage.getItem('sm_active_template_id');
          if (!savedSessionStr || !savedTemplateId) return null;
          let session = JSON.parse(savedSessionStr);
          const currentTemplates = loadTemplates();
          const currentOverrides = loadOverrides();
          let template = findTemplateById(savedTemplateId, currentTemplates, currentOverrides);
          if (session && template) {
              template = migrateTemplate(template);
              session.players = session.players.map((p: any) => ({ 
                  ...p, 
                  scores: migrateScores(p.scores, template!) 
              }));
              return session;
          }
          return null;
      } catch (e) { return null; }
  });

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => 
      (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );
  
  const [knownSysIds, setKnownSysIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_known_sys_ids') || '[]'); } catch { return []; }
  });

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_pinned_ids') || '[]'); } catch { return []; }
  });

  const [playerHistory, setPlayerHistory] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_player_history') || '[]'); } catch { return []; }
  });

  const [sessionImage, setSessionImage] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('sm_templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('sm_system_overrides', JSON.stringify(systemOverrides)); }, [systemOverrides]);
  useEffect(() => { localStorage.setItem('sm_known_sys_ids', JSON.stringify(knownSysIds)); }, [knownSysIds]);
  useEffect(() => { localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds)); }, [pinnedIds]);
  useEffect(() => { localStorage.setItem('sm_player_history', JSON.stringify(playerHistory)); }, [playerHistory]);
  
  useEffect(() => { 
      localStorage.setItem('app_theme', themeMode);
      document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);
  
  useEffect(() => {
    if (currentSession && activeTemplate) {
        localStorage.setItem('sm_current_session', JSON.stringify(currentSession));
        localStorage.setItem('sm_active_template_id', activeTemplate.id);
    } else {
        localStorage.removeItem('sm_current_session');
        localStorage.removeItem('sm_active_template_id');
    }
  }, [currentSession, activeTemplate]);

  const toggleTheme = () => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');

  const saveTemplate = (template: GameTemplate) => {
    const migratedTemplate = migrateTemplate({ ...template, updatedAt: Date.now() });
    
    setTemplates(prev => {
        const exists = prev.some(t => t.id === migratedTemplate.id);
        if (exists) return prev.map(t => t.id === migratedTemplate.id ? migratedTemplate : t);
        return [migratedTemplate, ...prev];
    });

    if (googleDriveService.isAuthorized) {
        googleDriveService.backupTemplate(migratedTemplate).then((updated) => {
            // Success! Update the sync timestamp locally
            setTemplates(prev => prev.map(t => t.id === updated.id ? { ...t, lastSyncedAt: Date.now() } : t));
        }).catch(console.error);
    }
  };

  const deleteTemplate = (id: string) => {
      const templateToDelete = templates.find(t => t.id === id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (googleDriveService.isAuthorized && templateToDelete) {
          googleDriveService.softDeleteFolder(id, templateToDelete.name).then(() => {
              showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
          }).catch(console.error);
      }
  };
  
  const togglePin = (id: string) => setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev]);

  const updatePlayerHistory = (newName: string) => {
      if (!newName.trim()) return;
      const cleanName = newName.trim();
      setPlayerHistory(prev => [cleanName, ...prev.filter(n => n !== cleanName)].slice(0, 20));
  };

  const startSession = (template: GameTemplate, playerCount: number) => {
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
    
    const newSession: GameSession = { id: generateId(), templateId: migratedTemplate.id, startTime: Date.now(), players: players, status: 'active' };
    setActiveTemplate(migratedTemplate);
    setCurrentSession(newSession);
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
    setCurrentSession({ ...currentSession, id: generateId(), players: resetPlayers, startTime: Date.now() });
  };

  const exitSession = () => {
      if (activeTemplate && googleDriveService.isAuthorized) {
          const isSystem = DEFAULT_TEMPLATES.some(dt => dt.id === activeTemplate.id);
          if (!isSystem) {
              googleDriveService.backupTemplate(activeTemplate).then(() => {
                  // After successful exit sync, update the local template's sync timestamp
                  setTemplates(prev => prev.map(t => t.id === activeTemplate.id ? { ...t, lastSyncedAt: Date.now() } : t));
              }).catch(console.error);
          }
      }
      setCurrentSession(null);
      setActiveTemplate(null);
      setSessionImage(null);
  };

  const updateActiveTemplate = (updatedTemplate: GameTemplate) => {
      const migratedTemplate = migrateTemplate({ ...updatedTemplate, updatedAt: Date.now() });
      setActiveTemplate(migratedTemplate);
      const isSystem = DEFAULT_TEMPLATES.some(dt => dt.id === migratedTemplate.id);
      if (isSystem) setSystemOverrides(prev => ({ ...prev, [migratedTemplate.id]: migratedTemplate }));
      else setTemplates(prev => prev.map(t => t.id === migratedTemplate.id ? migratedTemplate : t));
      
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({ 
              ...player, 
              totalScore: calculatePlayerTotal(player, migratedTemplate, currentSession.players) 
          }));
          setCurrentSession({ ...currentSession, players: updatedPlayers });
      }
  };

  const markSystemTemplatesSeen = () => setKnownSysIds(DEFAULT_TEMPLATES.map(t => t.id));
  const restoreSystemTemplate = (templateId: string) => {
      const newOverrides = { ...systemOverrides };
      delete newOverrides[templateId];
      setSystemOverrides(newOverrides);
  };

  const systemTemplates = useMemo(() => {
    return DEFAULT_TEMPLATES.map(dt => {
      if (systemOverrides[dt.id]) return systemOverrides[dt.id];
      return migrateTemplate(dt);
    });
  }, [systemOverrides]);

  return { 
      templates, setTemplates, systemOverrides, systemTemplates, 
      knownSysIds, pinnedIds, currentSession, activeTemplate, playerHistory, 
      sessionImage, setSessionImage, themeMode, toggleTheme,
      saveTemplate, deleteTemplate, togglePin, updatePlayerHistory, 
      startSession, updateSession, resetSessionScores, exitSession, 
      updateActiveTemplate, markSystemTemplatesSeen, restoreSystemTemplate 
  };
};

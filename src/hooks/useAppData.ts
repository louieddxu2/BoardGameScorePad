
import { useState, useEffect, useMemo, useRef } from 'react';
import { GameTemplate, GameSession, Player, ScoreColumn, ScoreValue, MappingRule, QuickAction, InputMethod } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';
import { generateId } from '../utils/idGenerator';
import { googleDriveService } from '../services/googleDrive';
import { useToast } from './useToast';

// --- Migration Logic (Pure Functions) ---

const migrateColumn = (oldCol: any): ScoreColumn => {
  let formula = oldCol.formula || 'a1';
  let constants: { c1?: number } | undefined = oldCol.constants;
  let f1: MappingRule[] | undefined = oldCol.f1;
  let quickActions: QuickAction[] | undefined = oldCol.quickActions;
  let inputType: InputMethod = oldCol.inputType || 'keypad';

  if (!oldCol.formula || !oldCol.inputType) {
    if (oldCol.type === 'select' || oldCol.type === 'boolean') {
      inputType = 'clicker';
      formula = 'a1';
      const oldOptions = oldCol.options || (oldCol.type === 'boolean' ? [
          { label: 'YES (達成)', value: oldCol.weight ?? 1 },
          { label: 'NO (未達成)', value: 0 }
      ] : []);
      
      quickActions = oldOptions.map((opt: any) => ({
          id: generateId(6),
          label: opt.label,
          value: opt.value,
          color: opt.color,
          isModifier: false
      }));
    } else if (oldCol.calculationType === 'sum-parts') {
      formula = 'a1+next';
      if (Array.isArray(oldCol.quickActions) && oldCol.quickActions.length > 0) {
          inputType = 'clicker';
      }
    } else if (oldCol.calculationType === 'product') {
      formula = 'a1×a2';
    } else if (Array.isArray(oldCol.mappingRules) && oldCol.mappingRules.length > 0) {
      formula = 'f1(a1)';
      f1 = oldCol.mappingRules;
    } else { 
      if (oldCol.weight !== undefined && oldCol.weight !== 1) {
        formula = 'a1×c1';
        constants = { c1: oldCol.weight };
      }
      if (!oldCol.inputType && Array.isArray(oldCol.quickButtons) && oldCol.quickButtons.length > 0) {
          inputType = 'clicker';
          formula = 'a1+next';
          quickActions = oldCol.quickButtons.map((v: number) => ({
              id: generateId(6),
              label: `${v > 0 ? '+' : ''}${v}`,
              value: v,
          }));
      }
    }
  }

  if (f1 && Array.isArray(f1)) {
    f1 = f1.map(rule => {
      if (rule.isLinear && rule.unitScore === undefined) {
        return { ...rule, unitScore: rule.score };
      }
      return rule;
    });
  }

  let displayMode: 'row' | 'overlay' | 'hidden' = oldCol.displayMode || 'row';

  const newCol: ScoreColumn = {
    id: oldCol.id,
    name: oldCol.name,
    color: oldCol.color,
    isScoring: oldCol.isScoring ?? true,
    formula,
    constants,
    f1,
    inputType,
    quickActions,
    unit: oldCol.unit,
    subUnits: oldCol.subUnits,
    rounding: oldCol.rounding || 'none',
    showPartsInGrid: oldCol.showPartsInGrid,
    buttonGridColumns: oldCol.buttonGridColumns,
    displayMode: displayMode, 
    visuals: oldCol.visuals,
    contentLayout: oldCol.contentLayout,
    isAuto: oldCol.isAuto,
    variableMap: oldCol.variableMap
  };
  return newCol;
};

const migrateTemplate = (template: any): GameTemplate => {
    if (!template || !template.columns?.length) return template;
    const { baseImage, ...rest } = template;
    return {
        ...rest,
        hasImage: rest.hasImage || !!baseImage, 
        columns: template.columns.map(migrateColumn),
        updatedAt: rest.updatedAt || rest.createdAt, // Ensure updatedAt exists
    };
};

const migrateScores = (scores: Record<string, any>, template: GameTemplate): Record<string, ScoreValue> => {
    const newScores: Record<string, ScoreValue> = {};
    Object.keys(scores).forEach(colId => {
        const oldScore = scores[colId];
        const col = template.columns.find(c => c.id === colId);
        if (!col || oldScore === undefined || oldScore === null) return;
        
        if (typeof oldScore === 'object' && oldScore !== null && oldScore.parts) {
            newScores[colId] = oldScore;
            return;
        }

        let parts: number[] = [];
        if ((col.formula || '').includes('+next')) {
            if (typeof oldScore === 'object' && oldScore !== null && oldScore.history) {
                parts = oldScore.history.map((s: string) => parseFloat(s)).filter((n: number) => !isNaN(n));
            }
        } else if (col.formula === 'a1×a2') {
             if (typeof oldScore === 'object' && oldScore !== null && oldScore.factors) {
                parts = oldScore.factors.map((f: any) => parseFloat(String(f))).filter((n: number) => !isNaN(n));
             }
        } else {
             let rawVal: number | undefined;
             if (typeof oldScore === 'object' && oldScore !== null && 'value' in oldScore) rawVal = oldScore.value;
             else if (typeof oldScore === 'number') rawVal = oldScore;
             else if (typeof oldScore === 'boolean') rawVal = oldScore ? 1 : 0;
             
             if (rawVal !== undefined) {
                const num = parseFloat(String(rawVal));
                if (!isNaN(num)) parts = [num];
             }
        }
        newScores[colId] = { parts };
    });
    return newScores;
};

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

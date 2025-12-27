
import { useState, useEffect, useMemo, useRef } from 'react';
import { GameTemplate, GameSession, Player, ScoreColumn, ScoreValue, MappingRule, QuickAction, InputMethod } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';

// --- Migration Logic Helpers ---

const migrateColumn = (oldCol: any): ScoreColumn => {
  // Base migration for structural changes
  let formula = oldCol.formula || 'a1';
  let constants: { c1?: number } | undefined = oldCol.constants;
  let f1: MappingRule[] | undefined = oldCol.f1;
  let quickActions: QuickAction[] | undefined = oldCol.quickActions;
  let inputType: InputMethod = oldCol.inputType || 'keypad';

  // Handling legacy types
  if (!oldCol.formula || !oldCol.inputType) {
    if (oldCol.type === 'select' || oldCol.type === 'boolean') {
      inputType = 'clicker';
      formula = 'a1';
      const oldOptions = oldCol.options || (oldCol.type === 'boolean' ? [
          { label: 'YES (達成)', value: oldCol.weight ?? 1 },
          { label: 'NO (未達成)', value: 0 }
      ] : []);
      
      quickActions = oldOptions.map((opt: any) => ({
          id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
              label: `${v > 0 ? '+' : ''}${v}`,
              value: v,
          }));
      }
    }
  }

  // [NEW MIGRATION] Support for unitScore distinction
  if (f1 && Array.isArray(f1)) {
    f1 = f1.map(rule => {
      if (rule.isLinear && rule.unitScore === undefined) {
        return { ...rule, unitScore: rule.score };
      }
      return rule;
    });
  }

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
  };
  return newCol;
};

const migrateTemplate = (template: any): GameTemplate => {
    if (!template || !template.columns?.length) return template;
    return {
        ...template,
        columns: template.columns.map(migrateColumn)
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

// --- Storage Helpers (Synchronous) ---

function loadFromStorage<T>(key: string, fallback: T, migrateFn?: (data: any) => T): T {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        return migrateFn ? migrateFn(parsed) : parsed;
    } catch (e) {
        console.error(`Error loading ${key} from storage`, e);
        return fallback;
    }
}

export const useAppData = () => {
  // 1. Synchronous Initialization (Lazy Init)
  // This ensures data is loaded BEFORE the first render, preventing any empty state overwrite.
  
  const [templates, setTemplates] = useState<GameTemplate[]>(() => 
      loadFromStorage('sm_templates', [], (data) => Array.isArray(data) ? data.map(migrateTemplate) : [])
  );

  const [systemOverrides, setSystemOverrides] = useState<Record<string, GameTemplate>>(() => 
      loadFromStorage('sm_system_overrides', {}, (data) => {
          const migrated: Record<string, GameTemplate> = {};
          Object.keys(data).forEach(key => { migrated[key] = migrateTemplate(data[key]); });
          return migrated;
      })
  );

  const [knownSysIds, setKnownSysIds] = useState<string[]>(() => 
      loadFromStorage('sm_known_sys_ids', [])
  );

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => 
      loadFromStorage('sm_pinned_ids', [])
  );

  const [playerHistory, setPlayerHistory] = useState<string[]>(() => 
      loadFromStorage('sm_player_history', [])
  );

  // Session needs special handling to resolve the active template immediately
  const [sessionData, setSessionData] = useState<{session: GameSession | null, activeTemplate: GameTemplate | null}>(() => {
      try {
          const savedSessionStr = localStorage.getItem('sm_current_session');
          const savedTemplateId = localStorage.getItem('sm_active_template_id');
          
          if (!savedSessionStr || !savedTemplateId) return { session: null, activeTemplate: null };

          let session = JSON.parse(savedSessionStr);
          
          // We need to look up the template from the ALREADY loaded sources (but we are inside useState)
          // Since templates/overrides state are initialized in the same render pass, we re-read storage for the lookup
          // or use the logic below which re-fetches to be safe and synchronous.
          
          // Re-fetch raw for lookup to ensure we match the current state logic
          const rawTemplates = loadFromStorage('sm_templates', [], (data) => Array.isArray(data) ? data.map(migrateTemplate) : []) as GameTemplate[];
          const rawOverrides = loadFromStorage('sm_system_overrides', {}, (data) => {
              const migrated: Record<string, GameTemplate> = {};
              Object.keys(data).forEach(key => { migrated[key] = migrateTemplate(data[key]); });
              return migrated;
          }) as Record<string, GameTemplate>;

          let template = rawTemplates.find(t => t.id === savedTemplateId) 
                         || rawOverrides[savedTemplateId] 
                         || DEFAULT_TEMPLATES.find(t => t.id === savedTemplateId);

          if (template) {
              template = migrateTemplate(template);
              // Migrate session scores against the template
              session.players = session.players.map((p: any) => ({ ...p, scores: migrateScores(p.scores, template) }));
              return { session, activeTemplate: template };
          }
      } catch (e) {
          console.error("Error init session", e);
      }
      return { session: null, activeTemplate: null };
  });

  const [currentSession, setCurrentSession] = useState<GameSession | null>(sessionData.session);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(sessionData.activeTemplate);

  // 2. Persistence Effects
  // Because state starts populated, these effects will simply save the valid data back to storage.
  // This is safe and standard.

  const isFirstRender = useRef(true);
  const isSessionFirstRender = useRef(true);

  useEffect(() => {
      if (isFirstRender.current) { isFirstRender.current = false; return; }
      localStorage.setItem('sm_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
      localStorage.setItem('sm_system_overrides', JSON.stringify(systemOverrides));
  }, [systemOverrides]);

  useEffect(() => {
      localStorage.setItem('sm_known_sys_ids', JSON.stringify(knownSysIds));
  }, [knownSysIds]);

  useEffect(() => {
      localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
      localStorage.setItem('sm_player_history', JSON.stringify(playerHistory));
  }, [playerHistory]);

  // SAFE SESSION PERSISTENCE
  // We use a separate isSessionFirstRender flag to ensure we NEVER delete data on the first mount.
  // We only want to delete data if the user explicitly performs an action that sets currentSession to null (like exitSession).
  useEffect(() => {
      if (isSessionFirstRender.current) { 
          isSessionFirstRender.current = false; 
          return; 
      }
      
      if (currentSession && activeTemplate) {
          localStorage.setItem('sm_current_session', JSON.stringify(currentSession));
          localStorage.setItem('sm_active_template_id', activeTemplate.id);
      } else {
          localStorage.removeItem('sm_current_session');
          localStorage.removeItem('sm_active_template_id');
      }
  }, [currentSession, activeTemplate]);


  // --- Actions ---

  const saveTemplate = (template: GameTemplate) => {
    const migratedTemplate = migrateTemplate(template);
    setTemplates(prev => {
        const exists = prev.some(t => t.id === migratedTemplate.id);
        if (exists) return prev.map(t => t.id === migratedTemplate.id ? migratedTemplate : t);
        return [migratedTemplate, ...prev];
    });
  };

  const deleteTemplate = (id: string) => setTemplates(prev => prev.filter(t => t.id !== id));
  const togglePin = (id: string) => setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev]);

  const updatePlayerHistory = (newName: string) => {
      if (!newName.trim()) return;
      const cleanName = newName.trim();
      setPlayerHistory(prev => [cleanName, ...prev.filter(n => n !== cleanName)].slice(0, 20));
  };

  const startSession = (template: GameTemplate, playerCount: number) => {
    const migratedTemplate = migrateTemplate(template);
    const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `玩家 ${i + 1}`,
      scores: {},
      totalScore: 0,
      color: COLORS[i % COLORS.length]
    }));
    const newSession: GameSession = { id: crypto.randomUUID(), templateId: migratedTemplate.id, startTime: Date.now(), players: players, status: 'active' };
    setActiveTemplate(migratedTemplate);
    setCurrentSession(newSession);
  };

  const updateSession = (updatedSession: GameSession) => {
      if (activeTemplate) {
        const playersWithTotal = updatedSession.players.map(p => ({ ...p, totalScore: calculatePlayerTotal(p, activeTemplate) }));
        setCurrentSession({ ...updatedSession, players: playersWithTotal });
      } else {
        setCurrentSession(updatedSession);
      }
  };
  
  const resetSessionScores = () => {
    if (!currentSession) return;
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0 }));
    setCurrentSession({ ...currentSession, id: crypto.randomUUID(), players: resetPlayers, startTime: Date.now() });
  };

  const exitSession = () => {
      setCurrentSession(null);
      setActiveTemplate(null);
  };

  const updateActiveTemplate = (updatedTemplate: GameTemplate) => {
      const migratedTemplate = migrateTemplate(updatedTemplate);
      setActiveTemplate(migratedTemplate);
      const isSystem = DEFAULT_TEMPLATES.some(dt => dt.id === migratedTemplate.id);
      if (isSystem) setSystemOverrides(prev => ({ ...prev, [migratedTemplate.id]: migratedTemplate }));
      else setTemplates(prev => prev.map(t => t.id === migratedTemplate.id ? migratedTemplate : t));
      
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({ ...player, totalScore: calculatePlayerTotal(player, migratedTemplate) }));
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

  return { templates, setTemplates, systemOverrides, systemTemplates, knownSysIds, pinnedIds, currentSession, activeTemplate, playerHistory, saveTemplate, deleteTemplate, togglePin, updatePlayerHistory, startSession, updateSession, resetSessionScores, exitSession, updateActiveTemplate, markSystemTemplatesSeen, restoreSystemTemplate };
};

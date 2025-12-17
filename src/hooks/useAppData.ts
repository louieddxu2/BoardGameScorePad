
import { useState, useEffect } from 'react';
import { GameTemplate, GameSession, Player } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { COLORS } from '../colors';
import { calculatePlayerTotal } from '../utils/scoring';

/**
 * This hook manages the core application data and persistence layer.
 * It strictly adheres to the existing localStorage keys to ensure backward compatibility.
 */
export const useAppData = () => {
  // --- Data State ---
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [systemOverrides, setSystemOverrides] = useState<Record<string, GameTemplate>>({});
  const [knownSysIds, setKnownSysIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  
  const [playerHistory, setPlayerHistory] = useState<string[]>([]);

  // --- Initialization (Load from LocalStorage) ---
  useEffect(() => {
    try {
        const savedTemplates = localStorage.getItem('sm_templates');
        const parsedUserTemplates = savedTemplates ? JSON.parse(savedTemplates) : [];

        const savedOverrides = localStorage.getItem('sm_system_overrides');
        const parsedOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
        setSystemOverrides(parsedOverrides);
        
        const savedKnownIds = localStorage.getItem('sm_known_sys_ids');
        const parsedKnownIds = savedKnownIds ? JSON.parse(savedKnownIds) : [];
        setKnownSysIds(parsedKnownIds);

        const savedPinnedIds = localStorage.getItem('sm_pinned_ids');
        const parsedPinnedIds = savedPinnedIds ? JSON.parse(savedPinnedIds) : [];
        setPinnedIds(parsedPinnedIds);

        setTemplates(parsedUserTemplates);

        // Load History
        const savedHistory = localStorage.getItem('sm_player_history');
        if (savedHistory) setPlayerHistory(JSON.parse(savedHistory));

    } catch(e) {
        console.error("Init Error", e);
        setTemplates([]);
    }
  }, []);

  // --- Session Restoration ---
  useEffect(() => {
    try {
        const savedSession = localStorage.getItem('sm_current_session');
        const savedActiveTemplateId = localStorage.getItem('sm_active_template_id');

        if (savedSession && savedActiveTemplateId) {
            const session = JSON.parse(savedSession);
            
            // Resolve template (User -> Override -> Default)
            let template = templates.find(t => t.id === savedActiveTemplateId);
            if (!template && systemOverrides[savedActiveTemplateId]) {
                template = systemOverrides[savedActiveTemplateId];
            }
            if (!template) {
                template = DEFAULT_TEMPLATES.find(t => t.id === savedActiveTemplateId);
            }

            if (template && session) {
                setCurrentSession(session);
                setActiveTemplate(template);
            }
        }
    } catch (e) {
        console.error("Failed to restore session", e);
    }
  }, [templates, systemOverrides]); // Depend on data load

  // --- Persistence Effects (Save to LocalStorage) ---
  useEffect(() => {
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
    if (currentSession && activeTemplate) {
        localStorage.setItem('sm_current_session', JSON.stringify(currentSession));
        localStorage.setItem('sm_active_template_id', activeTemplate.id);
    } else {
        localStorage.removeItem('sm_current_session');
        localStorage.removeItem('sm_active_template_id');
    }
  }, [currentSession, activeTemplate]);

  useEffect(() => {
      localStorage.setItem('sm_player_history', JSON.stringify(playerHistory));
  }, [playerHistory]);


  // --- Actions ---

  const saveTemplate = (template: GameTemplate) => {
    setTemplates(prev => {
        const exists = prev.some(t => t.id === template.id);
        if (exists) return prev.map(t => t.id === template.id ? template : t);
        return [template, ...prev];
    });
  };

  const deleteTemplate = (id: string) => {
      setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const togglePin = (id: string) => {
      setPinnedIds(prev => {
          if (prev.includes(id)) return prev.filter(pid => pid !== id);
          return [id, ...prev];
      });
  };

  const updatePlayerHistory = (newName: string) => {
      if (!newName.trim()) return;
      const cleanName = newName.trim();
      setPlayerHistory(prev => {
          const filtered = prev.filter(n => n !== cleanName);
          return [cleanName, ...filtered].slice(0, 20);
      });
  };

  const startSession = (template: GameTemplate, playerCount: number) => {
    const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `玩家 ${i + 1}`,
      scores: {},
      totalScore: 0,
      color: COLORS[i % COLORS.length]
    }));

    const newSession: GameSession = {
      id: crypto.randomUUID(),
      templateId: template.id,
      startTime: Date.now(),
      players: players,
      status: 'active'
    };

    setActiveTemplate(template);
    setCurrentSession(newSession);
  };

  const updateSession = (updatedSession: GameSession) => {
      if (activeTemplate) {
        // Auto-calculate totals whenever session updates
        const playersWithTotal = updatedSession.players.map(p => ({
            ...p,
            totalScore: calculatePlayerTotal(p, activeTemplate)
        }));
        setCurrentSession({ ...updatedSession, players: playersWithTotal });
      } else {
        setCurrentSession(updatedSession);
      }
  };
  
  const resetSessionScores = () => {
    if (!currentSession) return;
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0 }));
    const newSession: GameSession = {
        ...currentSession,
        id: crypto.randomUUID(),
        players: resetPlayers,
        startTime: Date.now()
    };
    setCurrentSession(newSession);
  };

  const exitSession = () => {
      setCurrentSession(null);
      // Logic for removing from local storage is handled by the useEffect above
  };

  const updateActiveTemplate = (updatedTemplate: GameTemplate) => {
      setActiveTemplate(updatedTemplate);

      // Persist the changes to the correct storage location
      const isSystem = DEFAULT_TEMPLATES.some(dt => dt.id === updatedTemplate.id);
      if (isSystem) {
          setSystemOverrides(prev => ({ ...prev, [updatedTemplate.id]: updatedTemplate }));
      } else {
          setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      }
      
      // Recalculate scores if rules changed
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({
             ...player,
             totalScore: calculatePlayerTotal(player, updatedTemplate)
          }));
          setCurrentSession({ ...currentSession, players: updatedPlayers });
      }
  };

  const markSystemTemplatesSeen = () => {
      const allIds = DEFAULT_TEMPLATES.map(t => t.id);
      setKnownSysIds(allIds);
  };

  const restoreSystemTemplate = (templateId: string) => {
      const newOverrides = { ...systemOverrides };
      delete newOverrides[templateId];
      setSystemOverrides(newOverrides);
  };

  return {
    // Data
    templates,
    setTemplates, // Exposed for batch import
    systemOverrides,
    knownSysIds,
    pinnedIds,
    currentSession,
    activeTemplate,
    playerHistory,
    
    // Actions
    saveTemplate,
    deleteTemplate,
    togglePin,
    updatePlayerHistory,
    startSession,
    updateSession,
    resetSessionScores,
    exitSession,
    updateActiveTemplate,
    markSystemTemplatesSeen,
    restoreSystemTemplate
  };
};

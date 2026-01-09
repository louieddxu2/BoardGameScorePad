
import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { GameTemplate, TemplatePreference, GameSession } from '../types';

export const useAppQueries = (searchQuery: string) => {
  // Fetch Preferences separately to merge later
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

  // helper for external use (e.g. by SessionManager)
  const getTemplate = async (id: string): Promise<GameTemplate | null> => {
      let t = await db.templates.get(id);
      if (t) return mergePrefs(t, prefsMap);
      t = await db.systemOverrides.get(id);
      if (t) return mergePrefs(t, prefsMap);
      t = await db.builtins.get(id);
      if (t) return mergePrefs(t, prefsMap);
      return null;
  };

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

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  return {
      templates,
      userTemplatesCount: userTemplatesData.count,
      systemTemplates,
      systemTemplatesCount: builtinsData.count,
      systemOverrides,
      activeSessions, // Export raw array for Manager
      activeSessionIds,
      historyRecords: historyData.items,
      historyCount: historyData.count,
      playerHistory,
      locationHistory,
      getTemplate,
      getSessionPreview
  };
};

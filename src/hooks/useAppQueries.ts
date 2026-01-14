


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
      // Also check if there are preferences for the source template (fallback)
      // This is useful if preferences were set on the built-in before forking
      const sourcePref = template.sourceTemplateId ? prefsMap[template.sourceTemplateId] : undefined;
      
      if (!pref && !sourcePref) return template;
      
      return {
          ...template,
          lastPlayerCount: pref?.lastPlayerCount ?? sourcePref?.lastPlayerCount ?? template.lastPlayerCount,
          defaultScoringRule: pref?.defaultScoringRule ?? sourcePref?.defaultScoringRule ?? template.defaultScoringRule
      };
  }, []);

  // helper for external use (e.g. by SessionManager)
  const getTemplate = async (id: string): Promise<GameTemplate | null> => {
      let t = await db.templates.get(id);
      if (t) return mergePrefs(t, prefsMap);
      
      // Fallback to builtins if not found in user templates
      // Note: We don't check systemOverrides anymore as it should be empty after migration
      t = await db.builtins.get(id);
      if (t) return mergePrefs(t, prefsMap);
      
      return null;
  };

  // A. Fetch All Templates from DB (User + Forked System)
  const allUserTemplatesData = useLiveQuery(async () => {
      let collection = db.templates.orderBy('updatedAt').reverse();
      
      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(t => t.name.toLowerCase().includes(lowerQ));
      }

      // [Optimization] Fetch all available image IDs to check existence without loading blobs
      const existingImageIds = await db.images.toCollection().primaryKeys();
      const imageSet = new Set(existingImageIds);

      // We fetch all to perform separation logic in memory
      // Since Dexie doesn't support complex OR queries easily on non-indexed fields
      const items = await collection.limit(200).toArray(list => list.map(t => ({
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
         globalVisuals: t.globalVisuals, // Keep visuals for icon detection
         lastPlayerCount: t.lastPlayerCount,
         defaultScoringRule: t.defaultScoringRule,
         columnCount: t.columns?.length || 0, // Inject metadata for list display
         sourceTemplateId: t.sourceTemplateId, // Critical for separation
         // [New] Inject local image status
         _localImageAvailable: t.imageId ? imageSet.has(t.imageId) : false
      } as any as GameTemplate)));

      return items;
  }, [searchQuery], []);

  // Separate "Pure User Templates" and "Shadow Templates (Forks)"
  const { userTemplates, shadowTemplatesMap } = useMemo(() => {
      const user: GameTemplate[] = [];
      const shadowMap: Record<string, GameTemplate> = {};
      
      allUserTemplatesData.forEach(t => {
          if (t.sourceTemplateId) {
              // It's a fork of a built-in
              shadowMap[t.sourceTemplateId] = mergePrefs(t, prefsMap);
          } else {
              // It's a pure custom template
              user.push(mergePrefs(t, prefsMap));
          }
      });
      
      return { userTemplates: user, shadowTemplatesMap: shadowMap };
  }, [allUserTemplatesData, prefsMap, mergePrefs]);
  
  // B. Built-in Templates
  const builtinsData = useLiveQuery(async () => {
      let collection = db.builtins.toCollection(); 
      
      if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          collection = collection.filter(t => t.name.toLowerCase().includes(lowerQ));
      }
      
      const count = await collection.count();
      const items = await collection.limit(100).toArray();
      
      return { count, items };
  }, [searchQuery], { count: 0, items: [] });

  // D. Active Sessions
  const activeSessions = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), [], []);
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  // E. History Records
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

  // F. Saved Lists
  const savedPlayers = useLiveQuery(() => db.savedPlayers.orderBy('lastUsed').reverse().limit(50).toArray(), [], []);
  const savedLocations = useLiveQuery(() => db.savedLocations.orderBy('lastUsed').reverse().limit(50).toArray(), [], []);

  const playerHistory = useMemo(() => savedPlayers?.map(p => p.name) || [], [savedPlayers]);
  const locationHistory = useMemo(() => savedLocations?.map(l => l.name) || [], [savedLocations]);

  // Combined System Templates (Masking Logic)
  const systemTemplates = useMemo(() => {
    return builtinsData.items.map(dt => {
      // Check if this built-in has a shadow fork
      if (shadowTemplatesMap[dt.id]) {
          return shadowTemplatesMap[dt.id]; // Return the fork (User modified version)
      }
      return mergePrefs(dt, prefsMap); // Return original
    });
  }, [builtinsData.items, shadowTemplatesMap, prefsMap, mergePrefs]);

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  return {
      templates: userTemplates,
      userTemplatesCount: userTemplates.length,
      systemTemplates,
      systemTemplatesCount: builtinsData.count,
      systemOverrides: shadowTemplatesMap, // Expose map for UI to show "Modified" badges if needed
      activeSessions,
      activeSessionIds,
      historyRecords: historyData.items,
      historyCount: historyData.count,
      playerHistory,
      locationHistory,
      getTemplate,
      getSessionPreview
  };
};
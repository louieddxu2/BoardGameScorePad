
import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GameTemplate, TemplatePreference } from '../../types';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { extractTemplateSummary, TemplateSummary } from '../../utils/extractDataSummaries';

export const useTemplateQuery = (searchQuery: string) => {
  // --- PREFERENCES & HELPERS ---
  const allPrefs = useLiveQuery(() => db.templatePrefs.toArray(), [], []);
  
  const prefsMap = useMemo(() => {
      const map: Record<string, TemplatePreference> = {};
      allPrefs?.forEach(p => { map[p.templateId] = p; });
      return map;
  }, [allPrefs]);

  const mergePrefs = useCallback((template: GameTemplate | TemplateSummary, prefsMap: Record<string, TemplatePreference>) => {
      const pref = prefsMap[template.id];
      const sourcePref = template.sourceTemplateId ? prefsMap[template.sourceTemplateId] : undefined;
      
      if (!pref && !sourcePref) return template as GameTemplate;
      
      return {
          ...template,
          lastPlayerCount: pref?.lastPlayerCount ?? sourcePref?.lastPlayerCount ?? template.lastPlayerCount,
          defaultScoringRule: pref?.defaultScoringRule ?? sourcePref?.defaultScoringRule ?? template.defaultScoringRule
      } as GameTemplate;
  }, []);

  const getTemplate = async (id: string): Promise<GameTemplate | null> => {
      let t = await db.templates.get(id);
      if (t) return mergePrefs(t, prefsMap);
      t = await db.builtins.get(id);
      if (t) return mergePrefs(t, prefsMap);
      return null;
  };

  // --- TEMPLATES (User) ---
  const allUserTemplatesData = useLiveQuery<TemplateSummary[]>(async () => {
      let collection = db.templates.orderBy('updatedAt').reverse();
      const fetchLimit = DATA_LIMITS.QUERY.FETCH_CAP; 
      const existingImageIds = await db.images.toCollection().primaryKeys();
      const imageSet = new Set(existingImageIds as string[]);

      const rawItems = await collection.limit(fetchLimit).toArray();

      // Inject properties using centralized extractor
      const mappedItems = rawItems.map(t => extractTemplateSummary(t, imageSet));

      return mappedItems;
  }, [], []);

  const filteredUserTemplates = useMemo<TemplateSummary[]>(() => {
      if (!allUserTemplatesData) return [];
      // [Update] Use _searchName architecture
      return searchService.search<TemplateSummary>(allUserTemplatesData, searchQuery, [
          { name: '_searchName', weight: 1.0 }
      ]);
  }, [allUserTemplatesData, searchQuery]);

  const { userTemplates, userTemplatesTotal, shadowTemplatesMap } = useMemo(() => {
      const user: GameTemplate[] = [];
      const shadowMap: Record<string, GameTemplate> = {};
      
      filteredUserTemplates.forEach(t => {
          const merged = mergePrefs(t, prefsMap);
          user.push(merged);
          if (t.sourceTemplateId) {
              shadowMap[t.sourceTemplateId] = merged;
          }
      });
      
      const pureUserTotal = user.filter(t => !t.sourceTemplateId).length;
      
      // [Fix] Do NOT slice here. Pass the full list to the UI layer so search works.
      // Slicing for display will be handled by the Dashboard view logic.
      const fullUserTemplates = user.filter(t => !t.sourceTemplateId);
      
      return { 
          userTemplates: fullUserTemplates, 
          userTemplatesTotal: pureUserTotal,
          shadowTemplatesMap: shadowMap 
      };
  }, [filteredUserTemplates, prefsMap, mergePrefs]);


  // --- TEMPLATES (Built-in) ---
  const allBuiltinsData = useLiveQuery<TemplateSummary[]>(async () => {
      const raw = await db.builtins.toArray();
      // Standardize Built-ins to TemplateSummary as well for consistent search architecture
      // Pass empty Set for images as built-ins don't use local DB images
      return raw.map(t => extractTemplateSummary(t, new Set()));
  }, [], []);

  const filteredBuiltins = useMemo<{ total: number, items: TemplateSummary[] }>(() => {
      if (!allBuiltinsData) return { total: 0, items: [] };
      // [Update] Use _searchName architecture
      const filtered = searchService.search<TemplateSummary>(allBuiltinsData, searchQuery, [
          { name: '_searchName', weight: 1.0 }
      ]);
      return {
          total: filtered.length,
          // [Fix] Do NOT slice here. Allow full list to propagate.
          items: filtered
      };
  }, [allBuiltinsData, searchQuery]);

  const systemTemplates = useMemo(() => {
    return filteredBuiltins.items.map((dt) => {
      // Check if there is a shadow/override from user templates
      if (shadowTemplatesMap[dt.id]) {
          return shadowTemplatesMap[dt.id]; 
      }
      return mergePrefs(dt, prefsMap); 
    });
  }, [filteredBuiltins.items, shadowTemplatesMap, prefsMap, mergePrefs]);

  return {
      templates: userTemplates,
      userTemplatesCount: userTemplatesTotal,
      systemTemplates,
      systemTemplatesCount: filteredBuiltins.total,
      systemOverrides: shadowTemplatesMap,
      getTemplate
  };
};

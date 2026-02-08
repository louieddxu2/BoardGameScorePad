
import { useMemo } from 'react';
import { GameTemplate, GameSession } from '../../../types';
import { DATA_LIMITS } from '../../../dataLimits';
import { isDisposableTemplate } from '../../../utils/templateUtils';

interface UseDashboardDataProps {
  userTemplates: GameTemplate[];
  systemTemplates: GameTemplate[];
  pinnedIds: string[];
  activeSessionIds: string[];
  getSessionPreview: (templateId: string) => GameSession | null;
}

export const useDashboardData = ({
  userTemplates,
  systemTemplates,
  pinnedIds,
  activeSessionIds,
  getSessionPreview
}: UseDashboardDataProps) => {

  const allTemplates = useMemo(() => [...userTemplates, ...systemTemplates], [userTemplates, systemTemplates]);

  // 1. Active Sessions
  const activeGameItems = useMemo(() => {
      return activeSessionIds.map(id => {
          const t = allTemplates.find(template => template.id === id);
          if (!t) return null;
          const session = getSessionPreview(id);
          const sortTime = session ? (session.lastUpdatedAt || session.startTime) : 0;
          return { template: t, timestamp: sortTime };
      })
      .filter((item): item is { template: GameTemplate, timestamp: number } => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activeSessionIds, allTemplates, getSessionPreview]);

  // 2. Pinned
  const pinnedTemplates = useMemo(() => {
    return pinnedIds
      .map(id => allTemplates.find(t => t.id === id))
      .filter((t): t is GameTemplate => t !== undefined);
  }, [pinnedIds, allTemplates]);
  
  // 3. User Library (Filtered & Sliced for UI)
  const userTemplatesToShow = useMemo(() => {
    // Filter out pinned templates AND disposable (0-column) templates
    // Disposable templates should only appear in "Active Sessions" or "History", not clutter the library.
    const filtered = userTemplates.filter(t => 
        !pinnedIds.includes(t.id) && 
        !t.sourceTemplateId && 
        !isDisposableTemplate(t)
    );
    // [UI Optimization] Slice here for display performance
    return filtered.slice(0, DATA_LIMITS.QUERY.USER_TEMPLATES);
  }, [userTemplates, pinnedIds]);

  // 4. System Library (Filtered & Sliced for UI)
  const systemTemplatesToShow = useMemo(() => {
    const filtered = systemTemplates.filter(t => !pinnedIds.includes(t.id));
    // [UI Optimization] Slice here for display performance
    return filtered.slice(0, DATA_LIMITS.QUERY.BUILTIN_TEMPLATES);
  }, [systemTemplates, pinnedIds]);

  // 5. Merged list for Search/StartGamePanel (Full List)
  // This uses the raw props (which should be the full lists from the query)
  const allVisibleTemplates = useMemo(() => {
      return [...userTemplates, ...systemTemplates];
  }, [userTemplates, systemTemplates]);

  return {
    activeGameItems,
    pinnedTemplates,
    userTemplatesToShow,
    systemTemplatesToShow,
    allVisibleTemplates
  };
};

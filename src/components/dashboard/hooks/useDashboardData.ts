
import { useMemo } from 'react';
import { GameTemplate, GameSession } from '../../../types';
import { DATA_LIMITS } from '../../../dataLimits';

interface UseDashboardDataProps {
  userTemplates: GameTemplate[];
  systemTemplates: GameTemplate[];
  pinnedIds: string[];
  activeSessionIds: string[];
  activeSessions: GameSession[] | undefined; 
  getSessionPreview: (templateId: string) => GameSession | null;
}

export const useDashboardData = ({
  userTemplates,
  systemTemplates,
  pinnedIds,
  activeSessions, 
}: UseDashboardDataProps) => {

  const allTemplates = useMemo(() => [...userTemplates, ...systemTemplates], [userTemplates, systemTemplates]);

  // 1. Active Sessions
  // 直接對 Session 進行時間排序，完全不依賴 Template 資料
  const sortedActiveSessions = useMemo(() => {
      if (!activeSessions) return [];
      return [...activeSessions].sort((a, b) => {
          const timeA = a.lastUpdatedAt || a.startTime;
          const timeB = b.lastUpdatedAt || b.startTime;
          return timeB - timeA;
      });
  }, [activeSessions]);

  // 2. Pinned
  const pinnedTemplates = useMemo(() => {
    return pinnedIds
      .map(id => allTemplates.find(t => t.id === id))
      .filter((t): t is GameTemplate => t !== undefined);
  }, [pinnedIds, allTemplates]);
  
  // 3. User Library (Filtered & Sliced for UI)
  const userTemplatesToShow = useMemo(() => {
    const filtered = userTemplates.filter(t => 
        !pinnedIds.includes(t.id) && 
        !t.sourceTemplateId
    );
    return filtered.slice(0, DATA_LIMITS.QUERY.USER_TEMPLATES);
  }, [userTemplates, pinnedIds]);

  // 4. System Library (Filtered & Sliced for UI)
  const systemTemplatesToShow = useMemo(() => {
    const filtered = systemTemplates.filter(t => !pinnedIds.includes(t.id));
    return filtered.slice(0, DATA_LIMITS.QUERY.BUILTIN_TEMPLATES);
  }, [systemTemplates, pinnedIds]);

  // 5. Merged list for Search/StartGamePanel (Full List)
  const allVisibleTemplates = useMemo(() => {
      return [...userTemplates, ...systemTemplates];
  }, [userTemplates, systemTemplates]);

  return {
    sortedActiveSessions,
    pinnedTemplates,
    userTemplatesToShow,
    systemTemplatesToShow,
    allVisibleTemplates
  };
};

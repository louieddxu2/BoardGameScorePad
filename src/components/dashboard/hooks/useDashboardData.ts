
import { useMemo } from 'react';
import { GameTemplate, GameSession, ScoringRule } from '../../../types';
import { DATA_LIMITS } from '../../../dataLimits';
import { createVirtualTemplate } from '../../../utils/templateUtils';
import type { GameOption } from '../../../features/game-selector/types';

export interface RecentTemplateShortcut {
  template: GameTemplate;
  needsResolution: boolean;
}

interface UseDashboardDataProps {
  userTemplates: GameTemplate[];
  systemTemplates: GameTemplate[];
  pinnedIds: string[];
  recentlyPlayedGames: GameOption[];
  activeSessionIds: string[];
  activeSessions: GameSession[] | undefined; 
  getSessionPreview: (templateId: string) => GameSession | null;
}

export const useDashboardData = ({
  userTemplates,
  systemTemplates,
  pinnedIds,
  recentlyPlayedGames,
  activeSessions, 
}: UseDashboardDataProps) => {

  const allTemplates = useMemo(() => [...userTemplates, ...systemTemplates], [userTemplates, systemTemplates]);
  const templatesById = useMemo(() => new Map(allTemplates.map(template => [template.id, template])), [allTemplates]);

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
      .map(id => templatesById.get(id))
      .filter((t): t is GameTemplate => t !== undefined);
  }, [pinnedIds, templatesById]);

  const recentTemplates = useMemo(() => {
    return recentlyPlayedGames.map(game => {
      const template = game.templateId ? templatesById.get(game.templateId) : undefined;
      const shortcutId = game.templateId || `shortcut:${game.savedGameId || game.bggId || game.cleanName || game.displayName}`;
      return {
        template: template ?? createVirtualTemplate(
          shortcutId,
          game.cleanName || game.displayName,
          game.bggId,
          game.lastUsed || 0,
          game.defaultPlayerCount,
          game.defaultScoringRule as ScoringRule
        ),
        needsResolution: !template
      };
    });
  }, [recentlyPlayedGames, templatesById]);
  
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
    recentTemplates,
    userTemplatesToShow,
    systemTemplatesToShow,
    allVisibleTemplates
  };
};

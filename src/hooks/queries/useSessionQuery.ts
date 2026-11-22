
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GameSession } from '../../types';

const EMPTY_SESSIONS: GameSession[] = [];

export const useSessionQuery = () => {
  // --- ACTIVE SESSIONS ---
  const result = useLiveQuery(() => db.sessions.where('status').equals('active').toArray(), []);
  const activeSessions = result ?? EMPTY_SESSIONS;
  
  const activeSessionIds = useMemo(() => activeSessions?.map(s => s.templateId) || [], [activeSessions]);

  const getSessionPreview = (templateId: string): GameSession | null => {
      return activeSessions?.find(s => s.templateId === templateId) || null;
  };

  return {
      activeSessions,
      activeSessionsLoaded: result !== undefined,
      activeSessionIds,
      getSessionPreview
  };
};

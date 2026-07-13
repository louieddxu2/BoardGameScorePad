import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord } from '../../types';
import {
  MultiplayerBootstrapStore,
  MultiplayerHistoryStore,
  MultiplayerSnapshotStore,
} from './multiplayerPersistence';

export const multiplayerLocalStore: MultiplayerBootstrapStore & MultiplayerHistoryStore & MultiplayerSnapshotStore = {
  async getTemplate(id: string): Promise<GameTemplate | undefined> {
    return (await db.templates.get(id)) ?? await db.builtins.get(id);
  },
  putTemplate(template: GameTemplate) {
    return db.templates.put(template);
  },
  putSession(session: GameSession) {
    return db.sessions.put(session);
  },
  putHistory(record: HistoryRecord) {
    return db.history.put(record);
  },
  deleteSession(sessionId: string) {
    return db.sessions.delete(sessionId);
  },
};

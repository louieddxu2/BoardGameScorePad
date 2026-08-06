import { db } from '../../db';

const listeners = new Set<(sessionId: string) => void>();

const notifySessionDeleted = (sessionId: string) => {
  for (const listener of [...listeners]) listener(sessionId);
};

export const deleteSessionRecord = async (sessionId: string) => {
  await db.sessions.delete(sessionId);
  notifySessionDeleted(sessionId);
};

export const deleteSessionRecords = async (sessionIds: string[]) => {
  if (!sessionIds.length) return;
  await db.sessions.bulkDelete(sessionIds);
  for (const sessionId of sessionIds) notifySessionDeleted(sessionId);
};

export const subscribeToSessionDeletion = (listener: (sessionId: string) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};


import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessions } = vi.hoisted(() => ({
  sessions: { delete: vi.fn(async () => undefined), bulkDelete: vi.fn(async () => undefined) },
}));
vi.mock('../../db', () => ({ db: { sessions } }));

import { deleteSessionRecord, deleteSessionRecords, subscribeToSessionDeletion } from './sessionDeletionEvents';

describe('session deletion events', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('notifies multiplayer lifecycle after every single-record deletion', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionDeletion(listener);

    await deleteSessionRecord('session-1');

    expect(sessions.delete).toHaveBeenCalledWith('session-1');
    expect(listener).toHaveBeenCalledWith('session-1');
    unsubscribe();
  });

  it('notifies once for every record removed by bulk deletion', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionDeletion(listener);

    await deleteSessionRecords(['session-1', 'session-2']);

    expect(sessions.bulkDelete).toHaveBeenCalledWith(['session-1', 'session-2']);
    expect(listener.mock.calls).toEqual([['session-1'], ['session-2']]);
    unsubscribe();
  });
});

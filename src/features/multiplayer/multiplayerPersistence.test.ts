import { describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../types';
import { persistMultiplayerBootstrap, persistMultiplayerCompletion, persistMultiplayerSnapshot } from './multiplayerPersistence';
import { createSessionBootstrapPackage } from './sessionBootstrap';

const createColumn = (): ScoreColumn => ({
  id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none',
});
const createTemplate = (updatedAt = 100): GameTemplate => ({
  id: 'template-1', name: 'Template', columns: [createColumn()], createdAt: 1, updatedAt,
});
const createPlayer = (): Player => ({ id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 });
const createSession = (): GameSession => ({
  id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 10,
  players: [createPlayer()], status: 'active', scoringRule: 'HIGHEST_WINS',
});
const createMessage = (template = createTemplate(100)) => ({
  type: 'room:bootstrap' as const,
  roomId: 'room-1',
  package: createSessionBootstrapPackage({
    room: { roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 1 },
    template, session: createSession(), revision: 1, now: () => 20,
  }),
});

describe('multiplayer local persistence', () => {
  it('reuses an equal local template and only persists the session', async () => {
    const putTemplate = vi.fn(async () => undefined);
    const putSession = vi.fn(async () => undefined);
    const result = await persistMultiplayerBootstrap(createMessage(), {
      getTemplate: async () => createTemplate(100), putTemplate, putSession,
    });

    expect(result.decision.action).toBe('reuse-local');
    expect(putTemplate).not.toHaveBeenCalled();
    expect(putSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
  });

  it('overwrites only when the host template is newer', async () => {
    const putTemplate = vi.fn(async () => undefined);
    const result = await persistMultiplayerBootstrap(createMessage(createTemplate(200)), {
      getTemplate: async () => createTemplate(100), putTemplate, putSession: async () => undefined,
    });

    expect(result.decision.action).toBe('overwrite-local');
    expect(putTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'template-1', updatedAt: 200 }));
  });

  it('keeps a newer local template and creates one deterministic template copy for this session', async () => {
    const putTemplate = vi.fn(async () => undefined);
    const putSession = vi.fn(async () => undefined);
    const result = await persistMultiplayerBootstrap(createMessage(createTemplate(100)), {
      getTemplate: async () => createTemplate(200), putTemplate, putSession,
    });

    expect(result.decision).toEqual({
      action: 'add-session-copy',
      templateId: 'Multiplayer-session-1',
      sourceTemplateId: 'template-1',
      reason: 'local-newer',
    });
    expect(putTemplate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'Multiplayer-session-1', updatedAt: 100,
    }));
    expect(putSession).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'Multiplayer-session-1',
    }));
  });

  it('writes each player a final history record and removes the active session', async () => {
    const putHistory = vi.fn(async () => undefined);
    const deleteSession = vi.fn(async () => undefined);
    const session = createSession();
    session.status = 'completed';
    session.players[0].scores.points = { parts: [12] };
    session.players[0].totalScore = 12;

    const record = await persistMultiplayerCompletion({
      store: { putHistory, deleteSession }, template: createTemplate(), session, completedAt: 30,
    });

    expect(record.id).toBe('session-1');
    expect(record.players[0].scores.points).toEqual({ parts: [12] });
    expect(putHistory).toHaveBeenCalledWith(record);
    expect(deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('persists a valid host snapshot as the local active session', async () => {
    const putSession = vi.fn(async () => undefined);
    const snapshot = {
      type: 'session:snapshot' as const,
      roomId: 'room-1',
      sessionId: 'session-1',
      session: createSession(),
      revision: 4,
      updatedAt: 40,
    };

    const persisted = await persistMultiplayerSnapshot(snapshot, { putSession });

    expect(persisted).toEqual(snapshot.session);
    expect(putSession).toHaveBeenCalledWith(snapshot.session);
  });

  it('rejects a snapshot whose message session ID does not match its session data', async () => {
    await expect(persistMultiplayerSnapshot({
      type: 'session:snapshot',
      roomId: 'room-1',
      sessionId: 'other-session',
      session: createSession(),
      revision: 4,
      updatedAt: 40,
    }, { putSession: async () => undefined })).rejects.toThrow('invalid_session_snapshot');
  });
});

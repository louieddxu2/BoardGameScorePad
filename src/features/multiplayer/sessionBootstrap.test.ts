import { describe, expect, it } from 'vitest';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../types';
import { createHistoryRecordFromFinalSnapshot } from './multiplayerHistory';
import { createMultiplayerHostSession, createMultiplayerPlayerSessionFromBootstrap } from './multiplayerSession';
import { isScoreValuePatchMessage, isSessionBootstrapPackage } from './protocol';
import {
  createSessionBootstrapPackage,
  decideTemplateImport,
  resolveBootstrapImport,
} from './sessionBootstrap';

const createColumn = (overrides: Partial<ScoreColumn> = {}): ScoreColumn => ({
  id: 'points',
  name: 'Points',
  formula: 'a1',
  inputType: 'keypad',
  isScoring: true,
  rounding: 'none',
  ...overrides,
});

const createTemplate = (overrides: Partial<GameTemplate> = {}): GameTemplate => ({
  id: 'template-1',
  name: 'Template',
  columns: [createColumn()],
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
});

const createPlayer = (id: string): Player => ({
  id,
  name: id,
  color: '#fff',
  scores: {},
  totalScore: 0,
});

const createSession = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: 'session-1',
  templateId: 'template-1',
  name: 'Template',
  startTime: 1000,
  players: [createPlayer('p1'), createPlayer('p2')],
  status: 'active',
  scoringRule: 'HIGHEST_WINS',
  ...overrides,
});

describe('multiplayer bootstrap infrastructure', () => {
  it('chooses local template reuse or overwrite without creating redundant templates', () => {
    const remote = createTemplate({ updatedAt: 200 });

    expect(decideTemplateImport(remote, undefined)).toEqual({
      action: 'add-new',
      templateId: 'template-1',
    });

    expect(decideTemplateImport(remote, createTemplate({ updatedAt: 200 }))).toEqual({
      action: 'reuse-local',
      templateId: 'template-1',
    });

    expect(decideTemplateImport(remote, createTemplate({ updatedAt: 100 }))).toEqual({
      action: 'overwrite-local',
      templateId: 'template-1',
    });

    expect(decideTemplateImport(remote, createTemplate({ updatedAt: 300 }))).toEqual({
      action: 'use-session-copy-only',
      templateId: 'template-1',
      reason: 'local-newer',
    });
  });

  it('creates and validates a bootstrap package, then resolves it with local reuse', () => {
    const remoteTemplate = createTemplate({ updatedAt: 500 });
    const localTemplate = createTemplate({ name: 'Local Template', updatedAt: 500 });
    const bootstrap = createSessionBootstrapPackage({
      room: { roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 1 },
      template: remoteTemplate,
      session: createSession(),
      revision: 3,
      now: () => 9,
    });

    expect(isSessionBootstrapPackage(bootstrap)).toBe(true);

    const resolved = resolveBootstrapImport(bootstrap, localTemplate);

    expect(resolved.decision).toEqual({ action: 'reuse-local', templateId: 'template-1' });
    expect(resolved.templateForSession.name).toBe('Local Template');
    expect(resolved.session.templateId).toBe('template-1');
    expect(resolved.session.status).toBe('active');
  });

  it('runs score patch, host snapshot, player catch-up, completion, and local history conversion without real transport', () => {
    let now = 1000;
    const getNow = () => now++;
    const template = createTemplate({ updatedAt: 500 });
    const session = createSession();

    const host = createMultiplayerHostSession({
      roomId: 'room-1',
      hostDeviceId: 'host-1',
      template,
      session,
      now: getNow,
    });

    const player = createMultiplayerPlayerSessionFromBootstrap({
      bootstrapMessage: host.createBootstrapMessage(),
      localTemplate: createTemplate({ updatedAt: 500 }),
      now: getNow,
    });

    const patchMessage = player.createScoreValuePatchMessage({
      deviceId: 'device-p1',
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: { parts: [12] },
      opId: 'op-1',
    });

    expect(isScoreValuePatchMessage(patchMessage)).toBe(true);

    const patchResult = host.receiveScoreValuePatch(patchMessage);
    expect(patchResult.accepted).toBe(true);
    if (!patchResult.accepted) return;

    expect(host.session.players[0].scores.points).toEqual({ parts: [12] });
    expect(host.session.players[0].totalScore).toBe(12);
    expect(player.applySnapshot(patchResult.snapshot)).toBe(true);
    expect(player.session.players[0].scores.points).toEqual({ parts: [12] });

    const completed = host.complete();
    expect(player.applyCompleted(completed)).toBe(true);
    expect(player.session.status).toBe('completed');

    const history = createHistoryRecordFromFinalSnapshot({
      template: player.template,
      session: player.session,
      completedAt: completed.completedAt,
    });

    expect(history.id).toBe('session-1');
    expect(history.players[0].scores.points).toEqual({ parts: [12] });
    expect(history.winnerIds).toEqual(['p1']);
    expect(history.snapshotTemplate?.id).toBe('template-1');
  });

  it('rejects invalid or stale mock messages', () => {
    const host = createMultiplayerHostSession({
      roomId: 'room-1',
      hostDeviceId: 'host-1',
      template: createTemplate(),
      session: createSession(),
      now: () => 1,
    });
    const player = createMultiplayerPlayerSessionFromBootstrap({
      bootstrapMessage: host.createBootstrapMessage(),
      now: () => 1,
    });

    const wrongRoomPatch = player.createScoreValuePatchMessage({
      deviceId: 'device-p1',
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: { parts: [1] },
      opId: 'op-wrong',
    });
    wrongRoomPatch.roomId = 'other-room';

    expect(host.receiveScoreValuePatch(wrongRoomPatch)).toEqual({
      accepted: false,
      reason: 'message_not_for_room',
    });

    expect(player.applySnapshot({
      type: 'session:snapshot',
      roomId: 'room-1',
      sessionId: 'session-1',
      session: createSession(),
      revision: 0,
      updatedAt: 1,
    })).toBe(false);
  });
});

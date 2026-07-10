import { GameSession, GameTemplate, ScoreValue } from '../../types';
import {
  BootstrapPackageMessage,
  MultiplayerRoomInfo,
  ScoreValuePatchMessage,
  SessionCompletedMessage,
  SessionSnapshotMessage,
} from './protocol';
import { applyScoreValuePatch, ScorePatchActor } from './scoreValuePatch';
import { createSessionBootstrapPackage, resolveBootstrapImport } from './sessionBootstrap';

export interface MultiplayerHostSession {
  role: 'host';
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  createBootstrapMessage(): BootstrapPackageMessage;
  receiveScoreValuePatch(message: ScoreValuePatchMessage): { accepted: true; snapshot: SessionSnapshotMessage } | { accepted: false; reason: string };
  complete(): SessionCompletedMessage;
}

export interface MultiplayerPlayerSession {
  role: 'player';
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  createScoreValuePatchMessage(input: {
    deviceId: string;
    actor: ScorePatchActor;
    targetPlayerId: string;
    colId: string;
    scoreValue: ScoreValue | null;
    opId: string;
  }): ScoreValuePatchMessage;
  applySnapshot(message: SessionSnapshotMessage): boolean;
  applyCompleted(message: SessionCompletedMessage): boolean;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createMultiplayerHostSession = (options: {
  roomId: string;
  hostDeviceId: string;
  template: GameTemplate;
  session: GameSession;
  revision?: number;
  now?: () => number;
}): MultiplayerHostSession => {
  const now = options.now ?? Date.now;
  const state = {
    room: {
      roomId: options.roomId,
      hostDeviceId: options.hostDeviceId,
      createdAt: now(),
    },
    template: cloneJson(options.template),
    session: cloneJson(options.session),
    revision: options.revision ?? 1,
  };

  return {
    role: 'host',
    get room() { return state.room; },
    get template() { return state.template; },
    get session() { return state.session; },
    get revision() { return state.revision; },

    createBootstrapMessage() {
      return {
        type: 'room:bootstrap',
        roomId: state.room.roomId,
        package: createSessionBootstrapPackage({
          room: state.room,
          template: state.template,
          session: state.session,
          revision: state.revision,
          now,
        }),
      };
    },

    receiveScoreValuePatch(message) {
      if (message.type !== 'score:valuePatch' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id) {
        return { accepted: false, reason: 'message_not_for_room' };
      }

      const result = applyScoreValuePatch(state.session, state.template, message.patch);
      if (!result.ok) return { accepted: false, reason: result.reason };

      state.session = result.session;
      state.revision += 1;

      return {
        accepted: true,
        snapshot: {
          type: 'session:snapshot',
          roomId: state.room.roomId,
          sessionId: state.session.id,
          session: cloneJson(state.session),
          revision: state.revision,
          updatedAt: now(),
        },
      };
    },

    complete() {
      state.session = { ...state.session, status: 'completed', lastUpdatedAt: now() };
      state.revision += 1;
      return {
        type: 'session:completed',
        roomId: state.room.roomId,
        sessionId: state.session.id,
        template: cloneJson(state.template),
        finalSession: cloneJson(state.session),
        revision: state.revision,
        completedAt: now(),
      };
    },
  };
};

export const createMultiplayerPlayerSessionFromBootstrap = (options: {
  bootstrapMessage: BootstrapPackageMessage;
  localTemplate?: GameTemplate | null;
  now?: () => number;
}): MultiplayerPlayerSession => {
  const now = options.now ?? Date.now;
  const resolved = resolveBootstrapImport(options.bootstrapMessage.package, options.localTemplate);
  const state = {
    room: cloneJson(options.bootstrapMessage.package.room),
    template: resolved.templateForSession,
    session: resolved.session,
    revision: options.bootstrapMessage.package.revision,
  };

  return {
    role: 'player',
    get room() { return state.room; },
    get template() { return state.template; },
    get session() { return state.session; },
    get revision() { return state.revision; },

    createScoreValuePatchMessage(input) {
      return {
        type: 'score:valuePatch',
        roomId: state.room.roomId,
        sessionId: state.session.id,
        opId: input.opId,
        deviceId: input.deviceId,
        updatedAt: now(),
        patch: {
          actor: input.actor,
          targetPlayerId: input.targetPlayerId,
          colId: input.colId,
          scoreValue: input.scoreValue,
        },
      };
    },

    applySnapshot(message) {
      if (message.type !== 'session:snapshot' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id) {
        return false;
      }
      if (message.revision < state.revision) return false;

      state.session = cloneJson(message.session);
      state.revision = message.revision;
      return true;
    },

    applyCompleted(message) {
      if (message.type !== 'session:completed' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id) {
        return false;
      }
      if (message.revision < state.revision) return false;

      state.template = cloneJson(message.template);
      state.session = cloneJson(message.finalSession);
      state.revision = message.revision;
      return true;
    },
  };
};

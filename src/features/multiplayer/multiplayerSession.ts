import { GameSession, GameTemplate, ScoreValue } from '../../types';
import { calculatePlayerTotal } from '../../utils/scoring';
import {
  BootstrapPackageMessage,
  MultiplayerRoomInfo,
  ScoreValuePatchMessage,
  ScorePatchResultMessage,
  TotalAdjustmentPatchMessage,
  SessionCompletedMessage,
  SessionSnapshotMessage,
} from './protocol';
import { applyScoreValueInputs, applyScoreValuePatch, calculateScoreSession, recalculateScoreSession, ScorePatchActor } from './scoreValuePatch';
import { createSessionBootstrapPackage, resolveBootstrapImport, ResolvedBootstrapImport } from './sessionBootstrap';

export interface MultiplayerHostSession {
  role: 'host';
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  createBootstrapMessage(): BootstrapPackageMessage;
  receiveScoreValuePatch(message: ScoreValuePatchMessage): { accepted: true; snapshot: SessionSnapshotMessage } | { accepted: false; reason: string };
  receiveTotalAdjustmentPatch(message: TotalAdjustmentPatchMessage): { accepted: true; snapshot: SessionSnapshotMessage } | { accepted: false; reason: string };
  applyLocalSession(session: GameSession): SessionSnapshotMessage | null;
  applyLocalBoard(template: GameTemplate, session: GameSession): SessionSnapshotMessage | null;
  complete(): SessionCompletedMessage;
}

export interface MultiplayerPlayerSession {
  role: 'player';
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  /** Confirmed inputs only; pending inputs are durably held in the outbox. */
  confirmedSession: GameSession;
  revision: number;
  createScoreValuePatchMessage(input: {
    deviceId: string;
    actor: ScorePatchActor;
    targetPlayerId: string;
    colId: string;
    scoreValue: ScoreValue | null;
    opId: string;
    sequence?: number;
  }): ScoreValuePatchMessage;
  applySnapshot(message: SessionSnapshotMessage): boolean;
  applyPendingOperation(message: ScoreValuePatchMessage | TotalAdjustmentPatchMessage): boolean;
  restorePendingOperations(messages: (ScoreValuePatchMessage | TotalAdjustmentPatchMessage)[]): void;
  applyPatchResult(message: ScorePatchResultMessage): { snapshotApplied: boolean; settledOpIds: string[] };
  applyBootstrap(input: { template: GameTemplate; session: GameSession; revision: number }): boolean;
  applyCompleted(message: SessionCompletedMessage): boolean;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createMultiplayerHostSession = (options: {
  roomId: string;
  hostDeviceId: string;
  template: GameTemplate;
  session: GameSession;
  revision?: number;
  createdAt?: number;
  now?: () => number;
}): MultiplayerHostSession => {
  const now = options.now ?? Date.now;
  const state = {
    room: {
      roomId: options.roomId,
      hostDeviceId: options.hostDeviceId,
      createdAt: options.createdAt ?? now(),
    },
    template: cloneJson(options.template),
    session: calculateScoreSession(cloneJson(options.session), options.template),
    revision: options.revision ?? 1,
    processedOperations: new Map<string, SessionSnapshotMessage>(),
    latestPlayerSequences: new Map<string, number>(),
  };

  const rememberOperation = (operationKey: string, snapshot: SessionSnapshotMessage) => {
    state.processedOperations.set(operationKey, cloneJson(snapshot));
    if (state.processedOperations.size > 256) {
      const oldestKey = state.processedOperations.keys().next().value;
      if (oldestKey) state.processedOperations.delete(oldestKey);
    }
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

      const operationKey = `${message.deviceId}:${message.opId}`;
      const duplicateSnapshot = state.processedOperations.get(operationKey);
      if (duplicateSnapshot) {
        return { accepted: true, snapshot: cloneJson(duplicateSnapshot) };
      }

      if (message.patch.actor.role === 'player') {
        const sequenceKey = `${message.deviceId}:${message.patch.actor.playerId}:${message.patch.targetPlayerId}:${message.patch.colId}`;
        const latestSequence = state.latestPlayerSequences.get(sequenceKey) ?? 0;
        if (message.sequence <= latestSequence) {
          return { accepted: false, reason: 'outdated_player_update' };
        }
        state.latestPlayerSequences.set(sequenceKey, message.sequence);
      }

      const result = applyScoreValuePatch(state.session, state.template, message.patch);
      if (!result.ok) return { accepted: false, reason: result.reason };

      state.session = result.session;
      state.revision += 1;

      const snapshot: SessionSnapshotMessage = {
        type: 'session:snapshot',
        roomId: state.room.roomId,
        sessionId: state.session.id,
        session: cloneJson(state.session),
        revision: state.revision,
        updatedAt: now(),
      };
      rememberOperation(operationKey, snapshot);

      return {
        accepted: true,
        snapshot,
      };
    },

    receiveTotalAdjustmentPatch(message) {
      if (message.type !== 'player:total-adjustment' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id) {
        return { accepted: false, reason: 'message_not_for_room' };
      }
      const operationKey = `${message.deviceId}:${message.opId}`;
      const duplicateSnapshot = state.processedOperations.get(operationKey);
      if (duplicateSnapshot) return { accepted: true, snapshot: cloneJson(duplicateSnapshot) };
      if (message.actor.role === 'player') {
        if (message.actor.playerId !== message.targetPlayerId) return { accepted: false, reason: 'player_cannot_edit_other_player' };
        const sequenceKey = `${message.deviceId}:${message.actor.playerId}:${message.targetPlayerId}:__TOTAL__`;
        const latestSequence = state.latestPlayerSequences.get(sequenceKey) ?? 0;
        if (message.sequence <= latestSequence) return { accepted: false, reason: 'outdated_player_update' };
        state.latestPlayerSequences.set(sequenceKey, message.sequence);
      }
      const player = state.session.players.find((item) => item.id === message.targetPlayerId);
      if (!player) return { accepted: false, reason: 'player_not_found' };
      const baseTotal = player.totalScore - (player.bonusScore ?? 0);
      state.session = recalculateScoreSession({
        ...state.session,
        players: state.session.players.map((item) => item.id === player.id
          ? { ...item, bonusScore: message.targetTotal - baseTotal }
          : item),
      }, state.template);
      state.revision += 1;
      const snapshot: SessionSnapshotMessage = { type: 'session:snapshot', roomId: state.room.roomId, sessionId: state.session.id, session: cloneJson(state.session), revision: state.revision, updatedAt: now() };
      rememberOperation(operationKey, snapshot);
      return { accepted: true, snapshot };
    },

    applyLocalSession(session) {
      if (session.id !== state.session.id || session.status !== 'active') return null;
      state.session = recalculateScoreSession(cloneJson(session), state.template);
      state.revision += 1;
      return {
        type: 'session:snapshot', roomId: state.room.roomId, sessionId: state.session.id,
        session: cloneJson(state.session), revision: state.revision, updatedAt: now(),
      };
    },

    applyLocalBoard(template, session) {
      if (session.id !== state.session.id || session.status !== 'active' || session.templateId !== template.id) return null;
      state.template = cloneJson(template);
      state.session = recalculateScoreSession(cloneJson(session), state.template);
      state.revision += 1;
      return {
        type: 'session:snapshot', roomId: state.room.roomId, sessionId: state.session.id,
        session: cloneJson(state.session), revision: state.revision, updatedAt: now(),
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
  resolvedBootstrap?: ResolvedBootstrapImport;
  now?: () => number;
}): MultiplayerPlayerSession => {
  const now = options.now ?? Date.now;
  const resolved = options.resolvedBootstrap ?? resolveBootstrapImport(options.bootstrapMessage.package, options.localTemplate);
  type PendingOperation = ScoreValuePatchMessage | TotalAdjustmentPatchMessage;
  type PendingInput = { message: PendingOperation; bonusScore?: number; order: number; durable: boolean };
  const state = {
    room: cloneJson(options.bootstrapMessage.package.room),
    template: resolved.templateForSession,
    session: resolved.session,
    confirmedSession: resolved.session,
    revision: options.bootstrapMessage.package.revision,
    nextSequences: new Map<string, number>(),
    pending: new Map<string, PendingInput>(),
    pendingByCell: new Map<string, PendingInput>(),
    nextPendingOrder: 0,
  };

  const operationCell = (message: PendingOperation) => message.type === 'score:valuePatch'
    ? `${message.deviceId}:${message.patch.targetPlayerId}:${message.patch.colId}`
    : `${message.deviceId}:${message.targetPlayerId}:__TOTAL__`;
  const projectInputs = () => {
    let projected = state.confirmedSession;
    // Offline typing may create many outbox entries. Only the newest input per
    // cell affects the projection, so calculation work stays bounded by the board.
    for (const { message, bonusScore } of state.pendingByCell.values()) {
      if (message.type === 'score:valuePatch') {
        const result = applyScoreValueInputs(projected, state.template, message.patch);
        if (result.ok) projected = result.session;
      } else if (bonusScore !== undefined) {
        projected = { ...projected, players: projected.players.map(player => player.id === message.targetPlayerId
          ? { ...player, bonusScore } : player) };
      }
    }
    return projected;
  };
  const refreshSession = () => {
    const projected = projectInputs();
    const calculated = projected === state.confirmedSession
      ? projected : calculateScoreSession(projected, state.template, state.session);
    // No notification/recalculation on an ACK which leaves effective inputs unchanged.
    if (JSON.stringify(calculated) !== JSON.stringify(state.session)) state.session = calculated;
  };
  const addPending = (message: PendingOperation, restoring = false) => {
    if (message.roomId !== state.room.roomId || message.sessionId !== state.session.id || state.session.status !== 'active') return false;
    const existing = state.pending.get(message.opId);
    if (existing) {
      // Replace the provisional sequence after its atomic outbox write, not its input order.
      existing.message = cloneJson(message);
      existing.durable = true;
      return true;
    }
    if (message.type === 'score:valuePatch') {
      if (!applyScoreValueInputs(state.session, state.template, message.patch).ok) return false;
      state.pending.set(message.opId, { message: cloneJson(message), order: ++state.nextPendingOrder, durable: restoring });
    } else {
      const player = state.session.players.find(item => item.id === message.targetPlayerId);
      if (!player || !Number.isFinite(message.targetTotal) || message.actor.role !== 'player' || message.actor.playerId !== player.id) return false;
      const projected = restoring ? projectInputs() : state.session;
      const projectedPlayer = projected.players.find(item => item.id === player.id)!;
      const total = restoring ? calculatePlayerTotal(projectedPlayer, state.template, projected.players) : player.totalScore;
      const baseTotal = total - (projectedPlayer.bonusScore ?? 0);
      state.pending.set(message.opId, { message: cloneJson(message), bonusScore: message.targetTotal - baseTotal, order: ++state.nextPendingOrder, durable: restoring });
    }
    const cell = operationCell(message);
    const latest = state.pendingByCell.get(cell);
    if (!restoring || !latest || message.sequence > latest.message.sequence) {
      state.pendingByCell.set(cell, state.pending.get(message.opId)!);
    }
    return true;
  };
  const acceptSnapshot = (message: SessionSnapshotMessage) => {
    if (message.type !== 'session:snapshot' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id ||
        message.session.id !== state.session.id || message.revision <= state.revision || state.session.status !== 'active') return false;
    state.confirmedSession = calculateScoreSession({ ...cloneJson(message.session), templateId: state.template.id }, state.template, state.session);
    state.revision = message.revision;
    return true;
  };

  return {
    role: 'player',
    get room() { return state.room; },
    get template() { return state.template; },
    get session() { return state.session; },
    get confirmedSession() { return state.confirmedSession; },
    get revision() { return state.revision; },

    createScoreValuePatchMessage(input) {
      const sequenceKey = `${input.actor.role}:${input.actor.role === 'player' ? input.actor.playerId : ''}:${input.targetPlayerId}:${input.colId}`;
      const sequence = input.sequence ?? (state.nextSequences.get(sequenceKey) ?? 0) + 1;
      state.nextSequences.set(sequenceKey, sequence);
      return {
        type: 'score:valuePatch',
        roomId: state.room.roomId,
        sessionId: state.session.id,
        opId: input.opId,
        deviceId: input.deviceId,
        sequence,
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
      if (!acceptSnapshot(message)) return false;
      refreshSession();
      return true;
    },

    applyPendingOperation(message) {
      if (state.pending.has(message.opId)) return addPending(message);
      if (!addPending(message)) return false;
      refreshSession();
      return true;
    },

    restorePendingOperations(messages) {
      // Reconstruct in durable delivery order, deriving just once at the end.
      for (const message of messages) addPending(message, true);
      refreshSession();
    },

    applyPatchResult(message) {
      if (message.roomId !== state.room.roomId || message.sessionId !== state.session.id) return { snapshotApplied: false, settledOpIds: [] };
      const operation = state.pending.get(message.opId);
      const settledOpIds = [message.opId];
      state.pending.delete(message.opId);
      if (message.accepted && operation) {
        // A newer accepted value also supersedes older unacknowledged edits of that cell.
        for (const [opId, pending] of state.pending) {
          const older = pending.durable && operation.durable
            ? pending.message.sequence < operation.message.sequence : pending.order < operation.order;
          if (operationCell(pending.message) === operationCell(operation.message) && older) {
            state.pending.delete(opId);
            settledOpIds.push(opId);
          }
        }
      }
      if (operation) {
        const cell = operationCell(operation.message);
        let latest: PendingInput | undefined;
        for (const pending of state.pending.values()) {
          if (operationCell(pending.message) !== cell) continue;
          const newer = !latest || (pending.durable && latest.durable
            ? pending.message.sequence > latest.message.sequence : pending.order > latest.order);
          if (newer) latest = pending;
        }
        if (latest) state.pendingByCell.set(cell, latest);
        else state.pendingByCell.delete(cell);
      }
      const snapshotApplied = Boolean(message.accepted && message.snapshot && acceptSnapshot(message.snapshot));
      refreshSession();
      return { snapshotApplied, settledOpIds };
    },

    applyBootstrap(input) {
      if (state.session.status !== 'active' || input.session.id !== state.session.id || input.session.templateId !== input.template.id || input.revision < state.revision) {
        return false;
      }
      const sameTemplate = JSON.stringify(state.template) === JSON.stringify(input.template);
      state.template = cloneJson(input.template);
      state.confirmedSession = calculateScoreSession(cloneJson(input.session), state.template, sameTemplate ? state.session : undefined);
      state.revision = input.revision;
      if (!sameTemplate) state.session = state.confirmedSession;
      refreshSession();
      return true;
    },

    applyCompleted(message) {
      if (message.type !== 'session:completed' || message.roomId !== state.room.roomId || message.sessionId !== state.session.id) {
        return false;
      }
      if (message.revision < state.revision || (state.session.status === 'completed' && message.revision <= state.revision)) return false;

      const sameTemplate = JSON.stringify(state.template) === JSON.stringify(message.template);
      state.template = cloneJson(message.template);
      state.confirmedSession = calculateScoreSession(cloneJson(message.finalSession), state.template, sameTemplate ? state.session : undefined);
      state.session = state.confirmedSession;
      state.pending.clear();
      state.pendingByCell.clear();
      state.revision = message.revision;
      return true;
    },
  };
};

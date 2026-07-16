import { ScoreValue } from '../../types';
import { generateId } from '../../utils/idGenerator';
import {
  MultiplayerHostSession,
  MultiplayerPlayerSession,
} from './multiplayerSession';
import {
  isScorePatchResultMessage,
  isScoreValuePatchMessage,
  isParticipantClaimMessage,
  isParticipantClaimResultMessage,
  isSessionCompletedMessage,
  isTotalAdjustmentPatchMessage,
  ParticipantClaimResultMessage,
  ScorePatchResultMessage,
  ScoreValuePatchMessage,
  SessionSnapshotMessage,
  TotalAdjustmentPatchMessage,
} from './protocol';
import { ScorePatchActor } from './scoreValuePatch';
import {
  createOutboxRecord,
  MultiplayerDeliveryStore,
  reserveScorePatchSequence,
  scorePatchOperationKey,
  scorePatchSequenceKey,
} from './multiplayerDeliveryStore';
import { MultiplayerSnapshotStore, persistMultiplayerSnapshot } from './multiplayerPersistence';

export interface MultiplayerRoomTransport {
  sendToHost(message: unknown): boolean;
  sendToConnection(connection: unknown, message: unknown): boolean;
  broadcastLocalChanges(): Promise<void>;
  broadcastMessage?(message: unknown): boolean;
}

export type ParticipantClaimCounts = Record<string, number>;

/**
 * Domain coordinator only. UI and a concrete WebRTC/PeerJS constructor are
 * intentionally outside this boundary.
 */
export const createMultiplayerRoomController = (options: {
  role: 'host';
  hostSession: MultiplayerHostSession;
  deliveryStore: MultiplayerDeliveryStore;
  snapshotStore: MultiplayerSnapshotStore;
  transport: MultiplayerRoomTransport;
  onSnapshot?: (snapshot: SessionSnapshotMessage) => void | Promise<void>;
  onParticipantClaims?: (claims: ParticipantClaimCounts) => void | Promise<void>;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const bindings = new Map<unknown, { deviceId: string; playerIds: Set<string> }>();
  const getParticipantClaims = (): ParticipantClaimCounts => {
    const claims: ParticipantClaimCounts = {};
    for (const binding of bindings.values()) {
      for (const playerId of binding.playerIds) claims[playerId] = (claims[playerId] ?? 0) + 1;
    }
    return claims;
  };
  const publishParticipantClaims = async () => { await options.onParticipantClaims?.(getParticipantClaims()); };
  const makeResult = (message: Pick<ScoreValuePatchMessage, 'roomId' | 'sessionId' | 'opId'>, accepted: boolean, snapshot?: SessionSnapshotMessage, reason?: string): ScorePatchResultMessage => accepted
    ? { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: true, snapshot: snapshot! }
    : { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: false, reason: reason ?? 'rejected' };

  const receiveOne = async (message: unknown, connection: unknown) => {
      if (isParticipantClaimMessage(message)) {
        const validRoom = message.roomId === options.hostSession.room.roomId && message.sessionId === options.hostSession.session.id;
        const playerExists = options.hostSession.session.players.some((player) => player.id === message.playerId);
        const result: ParticipantClaimResultMessage = validRoom && playerExists
          ? { type: 'room:claim-result', roomId: message.roomId, sessionId: message.sessionId, accepted: true, playerId: message.playerId }
          : { type: 'room:claim-result', roomId: message.roomId, sessionId: message.sessionId, accepted: false, reason: validRoom ? 'player_not_found' : 'message_not_for_room' };
        if (result.accepted) {
          const existing = bindings.get(connection);
          const playerIds = existing?.deviceId === message.deviceId ? existing.playerIds : new Set<string>();
          playerIds.add(message.playerId);
          bindings.set(connection, { deviceId: message.deviceId, playerIds });
          await publishParticipantClaims();
        }
        options.transport.sendToConnection(connection, result);
        return true;
      }
      if (!isScoreValuePatchMessage(message) && !isTotalAdjustmentPatchMessage(message)) return false;
      const actor = isScoreValuePatchMessage(message) ? message.patch.actor : message.actor;
      const binding = bindings.get(connection);
      if (actor.role !== 'player' || !binding || binding.deviceId !== message.deviceId || !binding.playerIds.has(actor.playerId)) {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, 'participant_not_claimed'));
        return true;
      }
      const receiptId = scorePatchOperationKey(message.roomId, message.deviceId, message.opId);
      const existing = await options.deliveryStore.getReceipt(receiptId);
      if (existing) {
        const snapshot = {
          type: 'session:snapshot' as const, roomId: options.hostSession.room.roomId, sessionId: options.hostSession.session.id,
          session: options.hostSession.session, revision: options.hostSession.revision, updatedAt: now(),
        };
        options.transport.sendToConnection(connection, makeResult(message, true, snapshot));
        return true;
      }

      const result = isScoreValuePatchMessage(message)
        ? options.hostSession.receiveScoreValuePatch(message)
        : options.hostSession.receiveTotalAdjustmentPatch(message);
      if (!result.accepted) {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, result.reason));
        return true;
      }

      await persistMultiplayerSnapshot(result.snapshot, options.snapshotStore);
      await options.onSnapshot?.(result.snapshot);
      await options.deliveryStore.putReceipt({
        id: receiptId, roomId: message.roomId, sessionId: message.sessionId, deviceId: message.deviceId,
        opId: message.opId, acceptedRevision: result.snapshot.revision, updatedAt: now(),
      });
      options.transport.sendToConnection(connection, makeResult(message, true, result.snapshot));
      await options.transport.broadcastLocalChanges();
      return true;
  };
  let receiveQueue = Promise.resolve();
  return {
    receive(message: unknown, connection: unknown) {
      const next = receiveQueue.then(() => receiveOne(message, connection));
      receiveQueue = next.then(() => undefined, () => undefined);
      return next;
    },
    async releaseConnection(connection: unknown) {
      if (!bindings.delete(connection)) return false;
      await publishParticipantClaims();
      return true;
    },
    getParticipantClaims,
    async complete() {
      const message = options.hostSession.complete();
      await persistMultiplayerSnapshot({
        type: 'session:snapshot',
        roomId: message.roomId,
        sessionId: message.sessionId,
        session: message.finalSession,
        revision: message.revision,
        updatedAt: message.completedAt,
      }, options.snapshotStore);
      options.transport.broadcastMessage?.(message);
      return message;
    },
    async applyLocalSession(session: import('../../types').GameSession) {
      const snapshot = options.hostSession.applyLocalSession(session);
      if (!snapshot) return null;
      await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
      await options.onSnapshot?.(snapshot);
      await options.transport.broadcastLocalChanges();
      return snapshot;
    },
    async applyLocalBoard(template: import('../../types').GameTemplate, session: import('../../types').GameSession) {
      const snapshot = options.hostSession.applyLocalBoard(template, session);
      if (!snapshot) return null;
      await options.snapshotStore.putTemplate?.(options.hostSession.template);
      await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
      await options.onSnapshot?.(snapshot);
      await options.transport.broadcastLocalChanges();
      return snapshot;
    },
  };
};

export const createMultiplayerPlayerRoomController = (options: {
  playerSession: MultiplayerPlayerSession;
  deviceId: string;
  deliveryStore: MultiplayerDeliveryStore;
  snapshotStore: MultiplayerSnapshotStore;
  transport: MultiplayerRoomTransport;
  onClaimAccepted?: (playerId: string) => void | Promise<void>;
  onCompleted?: (message: import('./protocol').SessionCompletedMessage) => void | Promise<void>;
  onSnapshot?: (snapshot: SessionSnapshotMessage) => void | Promise<void>;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const send = (message: unknown) => options.transport.sendToHost(message);
  return {
    async queueScoreValuePatch(input: {
      actor: ScorePatchActor;
      targetPlayerId: string;
      colId: string;
      scoreValue: ScoreValue | null;
    }): Promise<ScoreValuePatchMessage> {
      const draft = options.playerSession.createScoreValuePatchMessage({ ...input, deviceId: options.deviceId, opId: generateId(), sequence: 1 });
      const sequence = await reserveScorePatchSequence({
        store: options.deliveryStore, key: scorePatchSequenceKey(draft), now,
      });
      const message = { ...draft, sequence, updatedAt: now() };
      await options.deliveryStore.putOutbox(createOutboxRecord(message));
      send(message);
      return message;
    },

    claimPlayer(playerId: string) {
      return send({ type: 'room:claim-player', roomId: options.playerSession.room.roomId, sessionId: options.playerSession.session.id, deviceId: options.deviceId, playerId });
    },

    async queueTotalAdjustment(input: { playerId: string; targetTotal: number }): Promise<TotalAdjustmentPatchMessage> {
      const draft: TotalAdjustmentPatchMessage = {
        type: 'player:total-adjustment', roomId: options.playerSession.room.roomId, sessionId: options.playerSession.session.id,
        opId: generateId(), deviceId: options.deviceId, sequence: 1, actor: { role: 'player', playerId: input.playerId },
        targetPlayerId: input.playerId, targetTotal: input.targetTotal, updatedAt: now(),
      };
      const sequence = await reserveScorePatchSequence({ store: options.deliveryStore, key: `${draft.roomId}:${draft.deviceId}:${input.playerId}:__TOTAL__`, now });
      const message = { ...draft, sequence, updatedAt: now() };
      await options.deliveryStore.putOutbox(createOutboxRecord(message));
      send(message);
      return message;
    },

    async receive(message: unknown) {
      if (isSessionCompletedMessage(message)) {
        if (!options.playerSession.applyCompleted(message)) return false;
        await options.onCompleted?.(message);
        return true;
      }
      if (isParticipantClaimResultMessage(message)) {
        if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
        if (message.accepted && message.playerId) await options.onClaimAccepted?.(message.playerId);
        return true;
      }
      if (!isScorePatchResultMessage(message)) return false;
      if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
      const outboxId = scorePatchOperationKey(message.roomId, options.deviceId, message.opId);
      if (!message.accepted) {
        await options.deliveryStore.deleteOutbox(outboxId);
        return true;
      }
      if (message.snapshot && options.playerSession.applySnapshot(message.snapshot)) {
        await persistMultiplayerSnapshot(message.snapshot, options.snapshotStore);
        await options.onSnapshot?.(message.snapshot);
      }
      await options.deliveryStore.deleteOutbox(outboxId);
      return true;
    },

    async replayPendingPatches() {
      const records = await options.deliveryStore.listOutbox(options.playerSession.room.roomId, options.playerSession.session.id);
      for (const record of records) {
        if (isScoreValuePatchMessage(record.message) || isTotalAdjustmentPatchMessage(record.message)) send(record.message);
      }
    },
  };
};

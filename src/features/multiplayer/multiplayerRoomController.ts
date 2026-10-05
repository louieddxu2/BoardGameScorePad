import { GameSession, ScoreValue } from '../../types';
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
  isParticipantClaimsUpdateMessage,
  isParticipantClaimsUpdateResultMessage,
  isParticipantLeaveMessage,
  isSessionCompletedAckMessage,
  isSessionCompletedMessage,
  isSessionSnapshotMessage,
  isTotalAdjustmentPatchMessage,
  ParticipantClaimResultMessage,
  ParticipantClaimsUpdateResultMessage,
  ScorePatchResultMessage,
  ScoreValuePatchMessage,
  SessionSnapshotMessage,
  TotalAdjustmentPatchMessage,
} from './protocol';
import { ScorePatchActor } from './scoreValuePatch';
import {
  MultiplayerDeliveryStore,
  reserveSequenceAndPutOutbox,
  scorePatchOperationKey,
  scorePatchSequenceKey,
} from './multiplayerDeliveryStore';
import { MultiplayerSnapshotStore, persistMultiplayerSnapshot } from './multiplayerPersistence';

export interface MultiplayerRoomTransport {
  sendToHost(message: unknown): boolean;
  sendToConnection(connection: unknown, message: unknown): boolean;
  closeConnection?(connection: unknown): boolean;
  broadcastLocalChanges(): Promise<void>;
  broadcastMessage?(message: unknown, exceptConnection?: unknown): boolean;
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
  const releaseExistingDeviceBindings = (deviceId: string, exceptConnection: unknown) => {
    for (const [existingConnection, binding] of bindings) {
      if (existingConnection === exceptConnection || binding.deviceId !== deviceId) continue;
      bindings.delete(existingConnection);
      options.transport.closeConnection?.(existingConnection);
    }
  };
  const broadcastSnapshot = (snapshot: SessionSnapshotMessage, exceptConnection?: unknown) => {
    options.transport.broadcastMessage?.(snapshot, exceptConnection);
  };
  let completionWaiter: { roomId: string; sessionId: string; pendingDeviceIds: Set<string>; resolve: () => void } | null = null;
  let completionPromise: Promise<import('./protocol').SessionCompletedMessage> | null = null;
  const acknowledgeCompletion = (deviceId: string) => {
    if (!completionWaiter) return;
    completionWaiter.pendingDeviceIds.delete(deviceId);
    if (completionWaiter.pendingDeviceIds.size === 0) completionWaiter.resolve();
  };
  const makeResult = (message: Pick<ScoreValuePatchMessage, 'roomId' | 'sessionId' | 'opId'>, accepted: boolean, snapshot?: SessionSnapshotMessage, reason?: string): ScorePatchResultMessage => accepted
    ? { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: true, snapshot: snapshot! }
    : { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: false, reason: reason ?? 'rejected' };

  const receiveOne = async (message: unknown, connection: unknown) => {
      if (isParticipantLeaveMessage(message)) {
        const validRoom = message.roomId === options.hostSession.room.roomId && message.sessionId === options.hostSession.session.id;
        const binding = bindings.get(connection);
        if (!validRoom || (binding && binding.deviceId !== message.deviceId)) return false;
        if (binding) {
          bindings.delete(connection);
          await publishParticipantClaims();
        }
        options.transport.closeConnection?.(connection);
        return true;
      }
      if (isSessionCompletedAckMessage(message)) {
        const binding = bindings.get(connection);
        const matchesActiveCompletion = completionWaiter &&
          completionWaiter.roomId === message.roomId &&
          completionWaiter.sessionId === message.sessionId;
        if (!binding || binding.deviceId !== message.deviceId || !matchesActiveCompletion) return false;
        acknowledgeCompletion(message.deviceId);
        return true;
      }
      if (isParticipantClaimsUpdateMessage(message)) {
        const validRoom = message.roomId === options.hostSession.room.roomId && message.sessionId === options.hostSession.session.id;
        const playerIds = [...new Set(message.playerIds)];
        const playersExist = playerIds.every((playerId) => options.hostSession.session.players.some((player) => player.id === playerId));
        const roomActive = options.hostSession.session.status === 'active';
        const accepted = validRoom && roomActive && playersExist;
        const result: ParticipantClaimsUpdateResultMessage = accepted
          ? { type: 'room:set-player-claims-result', roomId: message.roomId, sessionId: message.sessionId, accepted: true, playerIds }
          : { type: 'room:set-player-claims-result', roomId: message.roomId, sessionId: message.sessionId, accepted: false, reason: !roomActive && validRoom ? 'room_completed' : validRoom ? 'player_not_found' : 'message_not_for_room' };
        if (accepted) {
          releaseExistingDeviceBindings(message.deviceId, connection);
          bindings.set(connection, { deviceId: message.deviceId, playerIds: new Set(playerIds) });
          await publishParticipantClaims();
        }
        options.transport.sendToConnection(connection, result);
        return true;
      }
      if (isParticipantClaimMessage(message)) {
        const validRoom = message.roomId === options.hostSession.room.roomId && message.sessionId === options.hostSession.session.id;
        const playerExists = options.hostSession.session.players.some((player) => player.id === message.playerId);
        const roomActive = options.hostSession.session.status === 'active';
        const result: ParticipantClaimResultMessage = validRoom && roomActive && playerExists
          ? { type: 'room:claim-result', roomId: message.roomId, sessionId: message.sessionId, accepted: true, playerId: message.playerId }
          : { type: 'room:claim-result', roomId: message.roomId, sessionId: message.sessionId, accepted: false, reason: !roomActive && validRoom ? 'room_completed' : validRoom ? 'player_not_found' : 'message_not_for_room' };
        if (result.accepted) {
          releaseExistingDeviceBindings(message.deviceId, connection);
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
      if (options.hostSession.session.status !== 'active') {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, 'room_completed'));
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
      // The source already receives this full snapshot in its acknowledgement.
      broadcastSnapshot(result.snapshot, connection);
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
      if (completionPromise) return completionPromise;
      completionPromise = (async () => {
        const message = options.hostSession.complete();
        await persistMultiplayerSnapshot({
          type: 'session:snapshot',
          roomId: message.roomId,
          sessionId: message.sessionId,
          session: message.finalSession,
          revision: message.revision,
          updatedAt: message.completedAt,
        }, options.snapshotStore);
        const pendingDeviceIds = new Set([...bindings.values()].map((binding) => binding.deviceId));
        let completionTimeout: number | null = null;
        const acknowledged = new Promise<void>((resolve) => {
          completionWaiter = { roomId: message.roomId, sessionId: message.sessionId, pendingDeviceIds, resolve };
          if (pendingDeviceIds.size === 0) resolve();
          else completionTimeout = window.setTimeout(resolve, 1000);
        });
        options.transport.broadcastMessage?.(message);
        await acknowledged;
        if (completionTimeout !== null) window.clearTimeout(completionTimeout);
        completionWaiter = null;
        return message;
      })();
      return completionPromise;
    },
    async applyLocalSession(session: import('../../types').GameSession) {
      const snapshot = options.hostSession.applyLocalSession(session);
      if (!snapshot) return null;
      await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
      await options.onSnapshot?.(snapshot);
      broadcastSnapshot(snapshot);
      return snapshot;
    },
    async applyLocalBoard(template: import('../../types').GameTemplate, session: import('../../types').GameSession) {
      const snapshot = options.hostSession.applyLocalBoard(template, session);
      if (!snapshot) return null;
      await options.snapshotStore.putTemplate?.(options.hostSession.template);
      await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
      await options.onSnapshot?.(snapshot);
      return snapshot;
    },
    async publishBoard() {
      await options.transport.broadcastLocalChanges();
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
  onClaimsAccepted?: (playerIds: string[]) => void | Promise<void>;
  onCompleted?: (message: import('./protocol').SessionCompletedMessage) => void | Promise<void>;
  onSnapshot?: (snapshot: SessionSnapshotMessage) => void | Promise<void>;
  onLocalSession?: (session: GameSession) => void;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const send = (message: unknown) => options.transport.sendToHost(message);
  const publishLocalChange = (previous: GameSession) => {
    if (options.playerSession.session !== previous) options.onLocalSession?.(options.playerSession.session);
  };
  let lastQueuedAt = 0;
  const nextInputTime = () => (lastQueuedAt = Math.max(now(), lastQueuedAt + 1));
  let outboxQueue = Promise.resolve();
  const queueOperation = async <T extends ScoreValuePatchMessage | TotalAdjustmentPatchMessage>(draft: T, key: string): Promise<T> => {
    const previous = options.playerSession.session;
    if (!options.playerSession.applyPendingOperation(draft)) throw new Error('invalid_local_score_operation');
    publishLocalChange(previous);
    // Local calculation is synchronous. Only durable reservations/sends are serialized,
    // retaining input order even while IndexedDB or the host is slow.
    const task = outboxQueue.then(async () => {
      if (options.playerSession.session.status !== 'active') throw new Error('room_completed');
      const message = await reserveSequenceAndPutOutbox({
        store: options.deliveryStore, key, now,
        createMessage: (sequence) => ({ ...draft, sequence }),
      });
      options.playerSession.applyPendingOperation(message);
      return message;
    });
    outboxQueue = task.then(() => undefined, () => undefined);
    let message: T;
    try {
      message = await task;
    } catch (error) {
      const current = options.playerSession.session;
      options.playerSession.applyPatchResult({ type: 'score:patch-result', roomId: draft.roomId, sessionId: draft.sessionId,
        opId: draft.opId, accepted: false, reason: 'local_outbox_failed' });
      publishLocalChange(current);
      throw error;
    }
    // A transport failure is not a durable-write failure: keep the pending edit for replay.
    if (options.playerSession.session.status === 'active') send(message);
    return message;
  };
  let unpersistedSnapshot: SessionSnapshotMessage | null = null;
  const settledOutboxIds = new Set<string>();
  const receiveOne = async (message: unknown) => {
    if (isSessionCompletedMessage(message)) {
      if (!options.playerSession.applyCompleted(message)) return false;
      unpersistedSnapshot = null;
      settledOutboxIds.clear();
      send({ type: 'session:completed:ack', roomId: message.roomId, sessionId: message.sessionId, deviceId: options.deviceId });
      await options.onCompleted?.({ ...message, finalSession: options.playerSession.confirmedSession });
      return true;
    }
    if (isParticipantClaimResultMessage(message)) {
      if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
      if (message.accepted && message.playerId) await options.onClaimAccepted?.(message.playerId);
      return true;
    }
    if (isParticipantClaimsUpdateResultMessage(message)) {
      if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
      if (message.accepted && message.playerIds) await options.onClaimsAccepted?.(message.playerIds);
      return true;
    }
    const previous = options.playerSession.session;
    let snapshot: SessionSnapshotMessage | undefined;
    let settledOpIds: string[] = [];
    if (isSessionSnapshotMessage(message)) {
      if (options.playerSession.applySnapshot(message)) snapshot = message;
      else if (!unpersistedSnapshot || message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
    } else if (isScorePatchResultMessage(message)) {
      if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
      const result = options.playerSession.applyPatchResult(message);
      if (result.snapshotApplied && message.accepted) snapshot = message.snapshot;
      settledOpIds = result.settledOpIds;
    } else return false;

    for (const opId of settledOpIds) settledOutboxIds.add(scorePatchOperationKey(options.playerSession.room.roomId, options.deviceId, opId));
    if (snapshot) unpersistedSnapshot = { ...snapshot, session: options.playerSession.confirmedSession };
    const write = unpersistedSnapshot;
    if (write) {
      // Persist locally derived confirmed data, never unconfirmed optimistic inputs.
      // A failed write must remain retryable even though the model accepted its revision.
      await persistMultiplayerSnapshot(write, options.snapshotStore);
      unpersistedSnapshot = null;
    }
    for (const id of settledOutboxIds) {
      await options.deliveryStore.deleteOutbox(id);
      settledOutboxIds.delete(id);
    }
    if (write) {
      // Use the latest projection: a local input may have arrived during the write.
      await options.onSnapshot?.({ ...write, session: options.playerSession.session });
    } else publishLocalChange(previous);
    return true;
  };
  let receiveQueue = Promise.resolve();
  let pendingRestored = false;
  const readPendingMessages = async () => {
    await outboxQueue;
    const records = await options.deliveryStore.listOutbox(options.playerSession.room.roomId, options.playerSession.session.id);
    return records.filter(record => record.deviceId === options.deviceId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(record => record.message).filter((message): message is ScoreValuePatchMessage | TotalAdjustmentPatchMessage =>
        isScoreValuePatchMessage(message) || isTotalAdjustmentPatchMessage(message));
  };
  const restorePendingPatches = async () => {
    const messages = await readPendingMessages();
    if (!pendingRestored) {
      pendingRestored = true;
      const previous = options.playerSession.session;
      options.playerSession.restorePendingOperations(messages);
      for (const message of messages) lastQueuedAt = Math.max(lastQueuedAt, message.updatedAt);
      publishLocalChange(previous);
    }
    return messages;
  };
  return {
    async queueScoreValuePatch(input: {
      actor: ScorePatchActor;
      targetPlayerId: string;
      colId: string;
      scoreValue: ScoreValue | null;
    }): Promise<ScoreValuePatchMessage> {
      const draft = { ...options.playerSession.createScoreValuePatchMessage({ ...input, deviceId: options.deviceId, opId: generateId(), sequence: 1 }), updatedAt: nextInputTime() };
      return queueOperation(draft, scorePatchSequenceKey(draft));
    },

    claimPlayer(playerId: string) {
      return send({ type: 'room:claim-player', roomId: options.playerSession.room.roomId, sessionId: options.playerSession.session.id, deviceId: options.deviceId, playerId });
    },

    setPlayerClaims(playerIds: string[]) {
      return send({
        type: 'room:set-player-claims',
        roomId: options.playerSession.room.roomId,
        sessionId: options.playerSession.session.id,
        deviceId: options.deviceId,
        playerIds: [...new Set(playerIds)],
      });
    },

    leaveRoom() {
      return send({
        type: 'room:leave',
        roomId: options.playerSession.room.roomId,
        sessionId: options.playerSession.session.id,
        deviceId: options.deviceId,
      });
    },

    async queueTotalAdjustment(input: { playerId: string; targetTotal: number }): Promise<TotalAdjustmentPatchMessage> {
      const draft: TotalAdjustmentPatchMessage = {
        type: 'player:total-adjustment', roomId: options.playerSession.room.roomId, sessionId: options.playerSession.session.id,
        opId: generateId(), deviceId: options.deviceId, sequence: 1, actor: { role: 'player', playerId: input.playerId },
        targetPlayerId: input.playerId, targetTotal: input.targetTotal, updatedAt: nextInputTime(),
      };
      return queueOperation(draft, `${draft.roomId}:${draft.deviceId}:${input.playerId}:__TOTAL__`);
    },

    receive(message: unknown) {
      const task = receiveQueue.then(() => receiveOne(message));
      receiveQueue = task.then(() => undefined, () => undefined);
      return task;
    },

    restorePendingPatches,
    waitForPendingWrites: () => outboxQueue,
    async replayPendingPatches() {
      const messages = await restorePendingPatches();
      for (const message of messages) send(message);
    },
  };
};

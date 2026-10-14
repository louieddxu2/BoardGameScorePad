import { GameSession, ScoreValue } from '../../types';
import { generateId } from '../../utils/idGenerator';
import type { MultiplayerPlayerSession } from './multiplayerSession';
import type { MultiplayerRoomTransport } from './multiplayerRoomController';
import { cloneScoreValue, type ScorePatchActor } from './scoreValuePatch';
import {
  isBootstrapPackageMessage, isSessionCompletedMessage, isParticipantClaimResultMessage,
  isParticipantClaimsUpdateResultMessage, isSessionSnapshotMessage, isScorePatchResultMessage,
  isScoreValuePatchMessage, isTotalAdjustmentPatchMessage,
  ScoreValuePatchMessage, TotalAdjustmentPatchMessage, SessionSnapshotMessage,
} from './protocol';
import {
  MultiplayerDeliveryStore, reserveSequenceAndPutOutbox, scorePatchOperationKey, scorePatchSequenceKey,
} from './multiplayerDeliveryStore';
import {
  MultiplayerBootstrapStore, MultiplayerSnapshotStore, createMultiplayerRoomRecord, persistMultiplayerSnapshot,
} from './multiplayerPersistence';
import { resolveBootstrapImport } from './sessionBootstrap';

export const createMultiplayerPlayerRoomController = (options: {
  playerSession: MultiplayerPlayerSession;
  deviceId: string;
  deliveryStore: MultiplayerDeliveryStore;
  snapshotStore: MultiplayerSnapshotStore;
  bootstrapStore?: MultiplayerBootstrapStore;
  transport: MultiplayerRoomTransport;
  onClaimAccepted?: (playerId: string) => void | Promise<void>;
  onClaimsAccepted?: (playerIds: string[]) => void | Promise<void>;
  onCompleted?: (message: import('./protocol').SessionCompletedMessage) => void | Promise<void>;
  onSnapshot?: (snapshot: SessionSnapshotMessage) => void | Promise<void>;
  onLocalSession?: (session: GameSession) => void;
  isActive?: () => boolean;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const isActive = () => options.isActive?.() !== false;
  const send = (message: unknown) => isActive() && options.transport.sendToHost(message);
  const publishLocalChange = (previous: GameSession) => {
    if (isActive() && options.playerSession.session !== previous) options.onLocalSession?.(options.playerSession.session);
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
  const persistConfirmedChanges = async () => {
    const write = unpersistedSnapshot;
    // Retry persistence only, at most three attempts; never reapply inputs.
    for (let attempt = 0; ; attempt++) {
      try {
        if (unpersistedSnapshot) {
          const persisted = await persistMultiplayerSnapshot(unpersistedSnapshot, options.snapshotStore);
          unpersistedSnapshot = null;
          if (!persisted) return null;
        }
        for (const id of settledOutboxIds) {
          await options.deliveryStore.deleteOutbox(id);
          settledOutboxIds.delete(id);
        }
        break;
      } catch (error) {
        if (attempt >= 2) throw error;
      }
    }
    if (write && isActive()) {
      // A local input may have arrived during the write: publish its latest projection.
      await options.onSnapshot?.({ ...write, session: options.playerSession.session });
    }
    return Boolean(write);
  };
  const receiveOne = async (message: unknown) => {
    if (!isActive()) return false;
    if (isBootstrapPackageMessage(message)) {
      const store = options.bootstrapStore;
      if (!store || message.roomId !== options.playerSession.room.roomId || message.package.session.id !== options.playerSession.session.id || options.playerSession.session.status !== 'active') return false;
      const localTemplate = await store.getTemplate(message.package.template.id);
      if (!isActive()) return false;
      const resolved = resolveBootstrapImport(message.package, localTemplate);
      // Keep the existing local/newer-template import policy, but within a live
      // room the host's structure is authoritative even for equal timestamps.
      const template = { ...message.package.template, id: resolved.templateForSession.id };
      if (!options.playerSession.applyBootstrap({ template, session: resolved.session, revision: message.package.revision })) return false;
      const session = options.playerSession.confirmedSession;
      const updatedAt = Math.max(message.package.exportedAt, session.lastUpdatedAt ?? 0);
      const records = {
        template: options.playerSession.template,
        session,
        room: createMultiplayerRoomRecord({ room: options.playerSession.room, session, revision: options.playerSession.revision, role: 'player', updatedAt }),
        requireExistingSession: true,
        shouldPersist: isActive,
      };
      // Use the same receive queue as ACKs/snapshots, and persist confirmed inputs
      // only. A delayed template must not roll IndexedDB back or consume the outbox.
      for (let attempt = 0; ; attempt++) {
        if (!isActive()) return false;
        try {
          if (await store.persistBootstrap(records) === false) return false;
          break;
        } catch (error) {
          if (attempt >= 2) throw error;
        }
      }
      if (!isActive()) return false;
      unpersistedSnapshot = null;
      await options.onSnapshot?.({ type: 'session:snapshot', roomId: message.roomId, sessionId: session.id, session: options.playerSession.session, revision: options.playerSession.revision, updatedAt });
      return isActive();
    }
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
    // A single ACK must recover transient local failures without another network
    // message. Local media writes use the same persistence/notification policy.
    const persisted = await persistConfirmedChanges();
    if (!isActive() || persisted === null) return false;
    if (persisted === false) publishLocalChange(previous);
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
        isScoreValuePatchMessage(message) || isTotalAdjustmentPatchMessage(message))
      // Old durable inputs may still contain undefined option properties. Keep
      // their operation/sequence identities, but normalize before replaying them.
      .map(message => message.type === 'score:valuePatch' && message.patch.scoreValue !== null
        ? { ...message, patch: { ...message.patch, scoreValue: cloneScoreValue(message.patch.scoreValue) } }
        : message);
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

    applyLocalSessionMedia(session: GameSession) {
      if (options.isActive?.() === false) return Promise.resolve(null);
      const task = receiveQueue.then(async () => {
        if (!options.playerSession.applyLocalSessionMedia(session)) return null;
        unpersistedSnapshot = {
          type: 'session:snapshot', roomId: options.playerSession.room.roomId,
          sessionId: session.id, session: options.playerSession.confirmedSession,
          revision: options.playerSession.revision, updatedAt: now(),
        };
        if (await persistConfirmedChanges() === null) return null;
        return options.playerSession.session;
      });
      receiveQueue = task.then(() => undefined, () => undefined);
      return task;
    },

    restorePendingPatches,
    waitForPendingWrites: () => outboxQueue,
    waitForReceivedWrites: () => receiveQueue,
    async replayPendingPatches() {
      const messages = await restorePendingPatches();
      for (const message of messages) send(message);
    },
  };
};

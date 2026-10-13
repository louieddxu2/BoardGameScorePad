import { GameSession, GameTemplate } from '../../types';
import { createTemplateSelectionMigration } from '../../utils/sessionTemplateUpdate';
import { MultiplayerHostSession } from './multiplayerSession';
import {
  isScoreValuePatchMessage,
  isParticipantClaimMessage,
  isParticipantClaimsUpdateMessage,
  isParticipantLeaveMessage,
  isSessionCompletedAckMessage,
  isTotalAdjustmentPatchMessage,
  ParticipantClaimResultMessage,
  ParticipantClaimsUpdateResultMessage,
  ScorePatchResultMessage,
  ScoreValuePatchMessage,
  SessionSnapshotMessage,
} from './protocol';
import { mergeSessionInputChanges } from './scoreValuePatch';
import {
  MultiplayerDeliveryStore,
  acceptedScoreSequenceKey,
  scorePatchOperationKey,
} from './multiplayerDeliveryStore';
import { MultiplayerSnapshotStore, persistAcceptedMultiplayerSnapshot, persistMultiplayerSnapshot } from './multiplayerPersistence';
import { createScoreStateSyncItem, SyncItem } from './scoreStateSyncAdapter';

export interface MultiplayerRoomTransport {
  sendToHost(message: unknown): boolean;
  sendToConnection(connection: unknown, message: unknown): boolean;
  closeConnection?(connection: unknown): boolean;
  broadcastLocalChanges(item?: SyncItem): Promise<void>;
  broadcastMessage?(message: unknown, exceptConnection?: unknown): boolean;
}

export type ParticipantClaimCounts = Record<string, number>;
export type BoardSyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

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
  onBoardSyncStatus?: (status: BoardSyncStatus) => void;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const bindings = new Map<unknown, { deviceId: string; playerIds: Set<string> }>();
  const acceptedSequences = new Map<string, number>();
  let operationQueue = Promise.resolve();
  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const task = operationQueue.then(operation);
    operationQueue = task.then(() => undefined, () => undefined);
    return task;
  };
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
  let stopped = false;
  let boardGeneration = 0;
  let boardSyncStatus: BoardSyncStatus = 'synced';
  let boardSyncTimer: number | null = null;
  let boardSyncTask: Promise<void> | null = null;
  const setBoardSyncStatus = (status: BoardSyncStatus) => {
    if (stopped || status === boardSyncStatus) return;
    boardSyncStatus = status;
    options.onBoardSyncStatus?.(status);
  };
  const clearBoardSyncTimer = () => {
    if (boardSyncTimer !== null) window.clearTimeout(boardSyncTimer);
    boardSyncTimer = null;
  };
  const scheduleBoardSync = () => {
    clearBoardSyncTimer();
    if (stopped || completionPromise) return;
    setBoardSyncStatus('pending');
    boardSyncTimer = window.setTimeout(() => {
      boardSyncTimer = null;
      void publishBoard().catch(() => { /* The failure remains available for manual retry. */ });
    }, 250);
  };
  const publishBoard = (): Promise<void> => {
    clearBoardSyncTimer();
    if (stopped || completionPromise) return Promise.resolve();
    if (boardSyncTask) return boardSyncTask;
    let sentGeneration = boardGeneration;
    // Capture inside the existing commit queue; sending chunks must not block typing.
    const task = enqueue(async () => {
      if (stopped || completionPromise) return null;
      sentGeneration = boardGeneration;
      setBoardSyncStatus('syncing');
      return createScoreStateSyncItem(options.hostSession.createBootstrapMessage().package);
    }).then(async (item) => {
      if (!item || stopped || completionPromise) return;
      try {
        await options.transport.broadcastLocalChanges(item);
        if (sentGeneration === boardGeneration) setBoardSyncStatus('synced');
      } catch (error) {
        if (sentGeneration === boardGeneration) setBoardSyncStatus('error');
        throw error;
      }
    }).finally(() => {
      boardSyncTask = null;
      // An old transfer can never clear a more recent committed template edit.
      if (sentGeneration !== boardGeneration) scheduleBoardSync();
    });
    boardSyncTask = task;
    return task;
  };
  const acknowledgeCompletion = (deviceId: string) => {
    if (!completionWaiter) return;
    completionWaiter.pendingDeviceIds.delete(deviceId);
    if (completionWaiter.pendingDeviceIds.size === 0) completionWaiter.resolve();
  };
  const makeResult = (message: Pick<ScoreValuePatchMessage, 'roomId' | 'sessionId' | 'opId'>, accepted: boolean, snapshot?: SessionSnapshotMessage, reason?: string): ScorePatchResultMessage => accepted
    ? { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: true, snapshot: snapshot! }
    : { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: false, reason: reason ?? 'rejected' };

  const receiveOne = async (message: unknown, connection: unknown) => {
      if (stopped) return false;
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
      if (stopped) return false;
      if (existing) {
        const snapshot = {
          type: 'session:snapshot' as const, roomId: options.hostSession.room.roomId, sessionId: options.hostSession.session.id,
          session: options.hostSession.session, revision: options.hostSession.revision, updatedAt: now(),
        };
        options.transport.sendToConnection(connection, makeResult(message, true, snapshot));
        return true;
      }

      const sequenceKey = acceptedScoreSequenceKey(message);
      let acceptedSequence = acceptedSequences.get(sequenceKey);
      if (acceptedSequence === undefined) {
        acceptedSequence = (await options.deliveryStore.getSequence(sequenceKey))?.nextSequence ?? 1;
        acceptedSequences.set(sequenceKey, acceptedSequence);
      }
      if (stopped) return false;
      if (message.sequence < acceptedSequence) {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, 'outdated_player_update'));
        return true;
      }

      const result = isScoreValuePatchMessage(message)
        ? options.hostSession.receiveScoreValuePatch(message)
        : options.hostSession.receiveTotalAdjustmentPatch(message);
      if (!result.accepted) {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, result.reason));
        return true;
      }

      // A retry of a previously applied but failed write must persist current
      // inputs, not the old snapshot cached for that operation.
      const snapshot = result.snapshot.revision === options.hostSession.revision ? result.snapshot : {
        ...result.snapshot, session: options.hostSession.session, revision: options.hostSession.revision, updatedAt: now(),
      };
      const persisted = await persistAcceptedMultiplayerSnapshot(snapshot, options.snapshotStore, options.deliveryStore, {
        id: receiptId, roomId: message.roomId, sessionId: message.sessionId, deviceId: message.deviceId,
        opId: message.opId, acceptedRevision: snapshot.revision, updatedAt: now(),
      }, { id: sequenceKey, nextSequence: message.sequence + 1, updatedAt: now() });
      if (!persisted || stopped) return false;
      acceptedSequences.set(sequenceKey, message.sequence + 1);
      await options.onSnapshot?.(snapshot);
      if (stopped) return false;
      options.transport.sendToConnection(connection, makeResult(message, true, snapshot));
      // The source already receives this full snapshot in its acknowledgement.
      broadcastSnapshot(snapshot, connection);
      return true;
  };
  return {
    receive(message: unknown, connection: unknown) {
      return enqueue(() => receiveOne(message, connection));
    },
    async releaseConnection(connection: unknown) {
      if (!bindings.delete(connection)) return false;
      await publishParticipantClaims();
      return true;
    },
    getParticipantClaims,
    async complete() {
      if (completionPromise) return completionPromise;
      clearBoardSyncTimer();
      completionPromise = enqueue(async () => {
        if (stopped) throw new Error('room_stopped');
        const message = options.hostSession.complete();
        const persisted = await persistMultiplayerSnapshot({
          type: 'session:snapshot',
          roomId: message.roomId,
          sessionId: message.sessionId,
          session: message.finalSession,
          revision: message.revision,
          updatedAt: message.completedAt,
        }, options.snapshotStore);
        if (!persisted || stopped) throw new Error('room_stopped');
        const pendingDeviceIds = new Set([...bindings.values()].map((binding) => binding.deviceId));
        let completionTimeout: number | null = null;
        const acknowledged = new Promise<void>((resolve) => {
          completionWaiter = { roomId: message.roomId, sessionId: message.sessionId, pendingDeviceIds, resolve };
          if (pendingDeviceIds.size === 0) resolve();
          else completionTimeout = window.setTimeout(resolve, 1000);
        });
        options.transport.broadcastMessage?.(message);
        return { message, acknowledged, completionTimeout };
      }).then(async ({ message, acknowledged, completionTimeout }) => {
        await acknowledged;
        if (completionTimeout !== null) window.clearTimeout(completionTimeout);
        completionWaiter = null;
        return message;
      });
      return completionPromise;
    },
    applyLocalSession(session: GameSession, previous = options.hostSession.session) {
      if (stopped) return Promise.resolve(null);
      return enqueue(async () => {
        if (stopped || session.id !== options.hostSession.session.id || previous.id !== session.id || session.status !== 'active') return null;
        const merged = mergeSessionInputChanges(options.hostSession.session, previous, session);
        const snapshot = options.hostSession.applyLocalSession(merged);
        if (!snapshot) return null;
        const persisted = await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
        if (!persisted || stopped) return null;
        await options.onSnapshot?.(snapshot);
        if (stopped) return null;
        broadcastSnapshot(snapshot);
        return snapshot;
      });
    },
    applyLocalBoard(
      template: GameTemplate, session: GameSession,
      previous = options.hostSession.session, previousTemplate = options.hostSession.template,
    ) {
      return enqueue(async () => {
        if (stopped || session.id !== options.hostSession.session.id || previous.id !== session.id || session.status !== 'active' || session.templateId !== template.id) return null;
        // Generated selection IDs are not explicit host edits. Compare all three
        // inputs in the new schema, retaining the UI's original schema baseline.
        const migrateBaseline = createTemplateSelectionMigration(previousTemplate, template);
        const migrateCurrent = createTemplateSelectionMigration(options.hostSession.template, template);
        const merged = mergeSessionInputChanges(
          migrateCurrent(options.hostSession.session), migrateBaseline(previous), migrateBaseline(session),
        );
        const snapshot = options.hostSession.applyLocalBoard(template, merged);
        if (!snapshot) return null;
        await options.snapshotStore.putTemplate?.(options.hostSession.template);
        if (stopped) return null;
        const persisted = await persistMultiplayerSnapshot(snapshot, options.snapshotStore);
        if (!persisted || stopped) return null;
        await options.onSnapshot?.(snapshot);
        if (stopped) return null;
        boardGeneration++;
        scheduleBoardSync();
        return snapshot;
      });
    },
    publishBoard,
    stop() {
      stopped = true;
      clearBoardSyncTimer();
    },
    whenIdle: async () => {
      await operationQueue;
      await boardSyncTask?.catch(() => undefined);
    },
  };
};

export { createMultiplayerPlayerRoomController } from './multiplayerPlayerRoomController';

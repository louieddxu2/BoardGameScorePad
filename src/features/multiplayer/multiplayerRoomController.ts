import { ScoreValue } from '../../types';
import { generateId } from '../../utils/idGenerator';
import {
  MultiplayerHostSession,
  MultiplayerPlayerSession,
} from './multiplayerSession';
import {
  isScorePatchResultMessage,
  isScoreValuePatchMessage,
  ScorePatchResultMessage,
  ScoreValuePatchMessage,
  SessionSnapshotMessage,
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
}

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
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const makeResult = (message: ScoreValuePatchMessage, accepted: boolean, snapshot?: SessionSnapshotMessage, reason?: string): ScorePatchResultMessage => accepted
    ? { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: true, snapshot: snapshot! }
    : { type: 'score:patch-result', roomId: message.roomId, sessionId: message.sessionId, opId: message.opId, accepted: false, reason: reason ?? 'rejected' };

  return {
    async receive(message: unknown, connection: unknown) {
      if (!isScoreValuePatchMessage(message)) return false;
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

      const result = options.hostSession.receiveScoreValuePatch(message);
      if (!result.accepted) {
        options.transport.sendToConnection(connection, makeResult(message, false, undefined, result.reason));
        return true;
      }

      await persistMultiplayerSnapshot(result.snapshot, options.snapshotStore);
      await options.deliveryStore.putReceipt({
        id: receiptId, roomId: message.roomId, sessionId: message.sessionId, deviceId: message.deviceId,
        opId: message.opId, acceptedRevision: result.snapshot.revision, updatedAt: now(),
      });
      options.transport.sendToConnection(connection, makeResult(message, true, result.snapshot));
      await options.transport.broadcastLocalChanges();
      return true;
    },
  };
};

export const createMultiplayerPlayerRoomController = (options: {
  playerSession: MultiplayerPlayerSession;
  deviceId: string;
  deliveryStore: MultiplayerDeliveryStore;
  snapshotStore: MultiplayerSnapshotStore;
  transport: MultiplayerRoomTransport;
  now?: () => number;
}) => {
  const now = options.now ?? Date.now;
  const send = (message: ScoreValuePatchMessage) => options.transport.sendToHost(message);
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

    async receive(message: unknown) {
      if (!isScorePatchResultMessage(message)) return false;
      if (message.roomId !== options.playerSession.room.roomId || message.sessionId !== options.playerSession.session.id) return false;
      const outboxId = scorePatchOperationKey(message.roomId, options.deviceId, message.opId);
      if (!message.accepted) {
        await options.deliveryStore.deleteOutbox(outboxId);
        return true;
      }
      if (message.snapshot && options.playerSession.applySnapshot(message.snapshot)) {
        await persistMultiplayerSnapshot(message.snapshot, options.snapshotStore);
      }
      await options.deliveryStore.deleteOutbox(outboxId);
      return true;
    },

    async replayPendingPatches() {
      const records = await options.deliveryStore.listOutbox(options.playerSession.room.roomId, options.playerSession.session.id);
      for (const record of records) {
        if (isScoreValuePatchMessage(record.message)) send(record.message);
      }
    },
  };
};

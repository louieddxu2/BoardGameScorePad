import { db } from '../../db';
import { MultiplayerParticipantBindingRecord } from '../../types';

export interface MultiplayerParticipantBindingStore {
  get(id: string): Promise<MultiplayerParticipantBindingRecord | undefined>;
  put(record: MultiplayerParticipantBindingRecord): Promise<unknown>;
}

export const multiplayerParticipantBindingStore: MultiplayerParticipantBindingStore = {
  get: (id) => db.multiplayerParticipantBindings.get(id),
  put: (record) => db.multiplayerParticipantBindings.put(record),
};

export const participantBindingKey = (roomId: string, deviceId: string): string => `${roomId}:${deviceId}`;

export const saveParticipantBinding = async (options: {
  store?: MultiplayerParticipantBindingStore;
  roomId: string;
  sessionId: string;
  deviceId: string;
  playerId: string;
  now?: () => number;
}): Promise<MultiplayerParticipantBindingRecord> => {
  const record: MultiplayerParticipantBindingRecord = {
    id: participantBindingKey(options.roomId, options.deviceId), roomId: options.roomId,
    sessionId: options.sessionId, deviceId: options.deviceId, playerId: options.playerId,
    updatedAt: (options.now ?? Date.now)(),
  };
  await (options.store ?? multiplayerParticipantBindingStore).put(record);
  return record;
};

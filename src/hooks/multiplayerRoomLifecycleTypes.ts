import type { createMultiplayerP2PRuntimeTransport } from '../features/multiplayer/multiplayerP2PRuntimeTransport';
import type { BootstrapPackageMessage } from '../features/multiplayer/protocol';

export type ScorePadWindow = Window & {
  __boardGameScorePadMultiplayerActive?: boolean;
  __boardGameScorePadMultiplayerJoinPending?: boolean;
  __boardGameScorePadMultiplayerJoinRoomId?: string;
};

export type ActiveMultiplayerRoom = {
  roomId: string;
  role: 'host' | 'player';
  playerIds?: string[];
};

export type PendingMultiplayerJoin = {
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  transport: ReturnType<typeof createMultiplayerP2PRuntimeTransport>;
};

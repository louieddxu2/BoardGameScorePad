import { P2PDataConnection, P2PPeerConstructor, createP2PHandshakeSync } from './p2pHandshakeSync';
import { MultiplayerRoomRuntimeTransport } from './multiplayerRoomRuntime';
import { ScoreStateSyncAdapter } from './scoreStateSyncAdapter';

/**
 * Adapts the established metadata-first P2P handshake to the room runtime.
 * Bootstrap transfer remains in ScoreStateSyncAdapter; score operations pass
 * through to the runtime as ordinary domain messages.
 */
export const createMultiplayerP2PRuntimeTransport = (options: {
  Peer: P2PPeerConstructor;
  adapter: ScoreStateSyncAdapter;
  peerOptions?: unknown;
  chunkSize?: number;
  logger?: (message: string, level?: 'info' | 'error') => void;
}): MultiplayerRoomRuntimeTransport => {
  let receiver: ((message: unknown, connection?: unknown) => void | Promise<void>) | undefined;
  let connectionOpenHandler: (() => void | Promise<void>) | undefined;
  let connectionChangeHandler: ((connectionCount: number) => void | Promise<void>) | undefined;
  let connectionCloseHandler: ((connection: unknown) => void | Promise<void>) | undefined;
  const handshake = createP2PHandshakeSync({
    ...options,
    onMessage: (message, connection) => receiver?.(message, connection),
    onConnectionOpen: () => connectionOpenHandler?.(),
    onConnectionChange: (connectionCount) => connectionChangeHandler?.(connectionCount),
    onConnectionClose: (connection) => connectionCloseHandler?.(connection),
  });
  return {
    startHost: (roomId) => handshake.startHost(roomId),
    joinRoom: (roomId) => handshake.joinRoom(roomId),
    stop: () => handshake.stop(),
    sendToHost: (message) => handshake.sendToHost(message),
    sendToConnection: (connection, message) => handshake.sendToConnection(connection as P2PDataConnection, message),
    broadcastLocalChanges: () => handshake.broadcastLocalChanges(),
    broadcastMessage: (message) => handshake.broadcast(message),
    setMessageReceiver: (nextReceiver) => { receiver = nextReceiver; },
    setConnectionOpenHandler: (nextHandler) => { connectionOpenHandler = nextHandler; },
    setConnectionChangeHandler: (nextHandler) => { connectionChangeHandler = nextHandler; },
    setConnectionCloseHandler: (nextHandler) => { connectionCloseHandler = nextHandler; },
    getConnectionCount: () => handshake.getConnectionCount(),
  };
};

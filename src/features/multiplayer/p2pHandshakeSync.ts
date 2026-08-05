import { ScoreStateSyncAdapter, SyncItem } from './scoreStateSyncAdapter';

export interface P2PDataConnection {
  peer?: string;
  open: boolean;
  send(data: unknown): void;
  close(): void;
  on(event: 'open' | 'close' | 'error' | 'data', handler: (value?: unknown) => void): void;
}

export interface P2PPeer {
  destroyed?: boolean;
  connect(peerId: string): P2PDataConnection;
  destroy(): void;
  on(event: 'open' | 'connection' | 'error', handler: (value?: unknown) => void): void;
}

export interface P2PLifecycleTarget {
  visibilityState?: string;
  addEventListener?(event: 'visibilitychange', handler: () => void): void;
  removeEventListener?(event: 'visibilitychange', handler: () => void): void;
}

export type P2PPeerConstructor = new (id?: string, options?: unknown) => P2PPeer;

export interface P2PHandshakeSync {
  startHost(roomId: string): P2PPeer;
  joinRoom(roomId: string): P2PPeer;
  stop(): void;
  setupConnection(connection: P2PDataConnection): void;
  closeConnection(connection: P2PDataConnection): boolean;
  broadcastLocalChanges(): Promise<void>;
  broadcast(message: unknown): boolean;
  sendToHost(message: unknown): boolean;
  sendToConnection(connection: P2PDataConnection, message: unknown): boolean;
  getConnectionCount(): number;
}

type IncomingTransfer = {
  chunks: ArrayBuffer[];
  total: number;
  metadata: { id: string; version: number; meta?: Record<string, unknown> };
  timeoutId: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

/**
 * Metadata-first P2P handshake with the reconnect lifecycle from
 * architecture-kits/p2p-handshake 0.2.0. ScorePad-specific domain messages
 * and connection callbacks remain available alongside the generic protocol.
 */
export const createP2PHandshakeSync = (options: {
  Peer: P2PPeerConstructor;
  adapter: ScoreStateSyncAdapter;
  peerOptions?: unknown;
  chunkSize?: number;
  incomingTtlMs?: number;
  autoReconnect?: boolean;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  connectionOpenTimeoutMs?: number;
  bindVisibility?: boolean;
  lifecycleTarget?: P2PLifecycleTarget | null;
  onMessage?: (message: unknown, connection: P2PDataConnection) => void | Promise<void>;
  onConnectionOpen?: (connection: P2PDataConnection) => void | Promise<void>;
  onConnectionClose?: (connection: P2PDataConnection) => void | Promise<void>;
  onConnectionChange?: (connectionCount: number) => void | Promise<void>;
  logger?: (message: string, level?: 'info' | 'error') => void;
}): P2PHandshakeSync => {
  const chunkSize = options.chunkSize ?? 16 * 1024;
  const incomingTtlMs = options.incomingTtlMs ?? 60_000;
  const autoReconnect = options.autoReconnect ?? true;
  const reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;
  const reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 15_000;
  const connectionOpenTimeoutMs = options.connectionOpenTimeoutMs ?? 10_000;
  const lifecycleTarget = options.lifecycleTarget ?? (typeof document !== 'undefined' ? document : null);
  const connections = new Set<P2PDataConnection>();
  const connectionCleanups = new Map<P2PDataConnection, () => void>();
  const incoming = new Map<string, IncomingTransfer>();
  const broadcastedVersions = new Map<string, number>();

  let peer: P2PPeer | null = null;
  let hostConnection: P2PDataConnection | null = null;
  let desiredMode: 'host' | 'client' | null = null;
  let desiredRoomId: string | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let stopping = true;
  let disposing = false;
  let visibilityBound = false;

  const log = (message: string, level: 'info' | 'error' = 'info') => options.logger?.(message, level);
  const keyFor = (connection: P2PDataConnection, id: string) => `${connection.peer ?? 'unknown'}:${id}`;

  const clearIncoming = (key: string) => {
    const transfer = incoming.get(key);
    if (!transfer) return;
    window.clearTimeout(transfer.timeoutId);
    incoming.delete(key);
  };

  const clearAllIncoming = () => {
    for (const key of Array.from(incoming.keys())) clearIncoming(key);
  };

  const send = (connection: P2PDataConnection, message: unknown) => {
    if (!connection.open) return false;
    try {
      connection.send(message);
      return true;
    } catch (error) {
      log(`Send failed: ${String(error)}`, 'error');
      return false;
    }
  };

  const sendItem = async (connection: P2PDataConnection, item: SyncItem): Promise<boolean> => {
    if (!connection.open) return false;
    const buffer = await item.payload.arrayBuffer();
    const total = Math.max(1, Math.ceil(buffer.byteLength / chunkSize));
    if (!send(connection, {
      type: 'ITEM_START',
      itemId: item.id,
      totalChunks: total,
      metadata: { id: item.id, version: item.version, meta: item.meta ?? {} },
    })) return false;

    for (let index = 0; index < total; index += 1) {
      const sent = send(connection, {
        type: 'ITEM_CHUNK',
        itemId: item.id,
        index,
        chunk: buffer.slice(index * chunkSize, Math.min(buffer.byteLength, (index + 1) * chunkSize)),
      });
      if (!sent) return false;
      if (index % 5 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 10));
    }
    return true;
  };

  const requestMissing = async (connection: P2PDataConnection, remote: Array<{ id: string; version: number }>) => {
    const local = await options.adapter.listMetas();
    const localVersions = new Map(local.map((meta) => [meta.id, meta.version]));
    const ids = remote.filter((meta) => (localVersions.get(meta.id) ?? -1) < meta.version).map((meta) => meta.id);
    if (ids.length) send(connection, { type: 'REQUEST_ITEMS', ids });
  };

  const sendHello = async (connection: P2PDataConnection) => {
    const metas = await options.adapter.listMetas();
    send(connection, { type: 'HELLO', scope: options.adapter.getScope(), metas });
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer === null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const getOpenConnectionCount = () => Array.from(connections).filter((connection) => connection.open).length;

  const hasUsableTransport = () => {
    if (!peer || peer.destroyed) return false;
    return desiredMode === 'host' || getOpenConnectionCount() > 0;
  };

  const scheduleReconnect = (reason: string) => {
    if (stopping || disposing || !autoReconnect || desiredMode !== 'client' || reconnectTimer !== null) return;
    if (hasUsableTransport()) return;
    const delay = Math.min(reconnectBaseDelayMs * (2 ** reconnectAttempt), reconnectMaxDelayMs);
    reconnectAttempt += 1;
    log(`Reconnect scheduled in ${delay}ms (${reason})`);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (!stopping && desiredMode === 'client' && desiredRoomId && !hasUsableTransport()) createClientPeer(desiredRoomId);
    }, delay);
  };

  const disposeTransport = () => {
    disposing = true;
    const oldPeer = peer;
    peer = null;
    hostConnection = null;
    const oldConnections = Array.from(connections);
    connections.clear();
    clearAllIncoming();
    try {
      oldPeer?.destroy();
    } catch (error) {
      log(`Failed to destroy peer: ${String(error)}`, 'error');
    }
    for (const connection of oldConnections) {
      try {
        connection.close();
      } catch (error) {
        log(`Failed to close connection: ${String(error)}`, 'error');
      }
    }
    disposing = false;
  };

  const createHostPeer = (roomId: string): P2PPeer => {
    disposeTransport();
    const nextPeer = new options.Peer(roomId, options.peerOptions);
    peer = nextPeer;
    nextPeer.on('open', (openedId) => {
      if (peer !== nextPeer) return;
      reconnectAttempt = 0;
      if (typeof openedId === 'string' && openedId !== roomId) {
        log(`Host room id changed unexpectedly: ${openedId}`, 'error');
      }
    });
    nextPeer.on('connection', (connection) => {
      if (peer === nextPeer && isP2PConnection(connection)) setupConnection(connection);
    });
    nextPeer.on('error', (error) => {
      if (peer !== nextPeer) return;
      log(`Peer error: ${String(error)}`, 'error');
      disposeTransport();
      // A host stays reachable while its Peer is alive; retry only when that Peer fails.
      if (!stopping && autoReconnect && desiredMode === 'host' && desiredRoomId) {
        const delay = Math.min(reconnectBaseDelayMs * (2 ** reconnectAttempt), reconnectMaxDelayMs);
        reconnectAttempt += 1;
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          if (!stopping && desiredMode === 'host' && desiredRoomId) createHostPeer(desiredRoomId);
        }, delay);
      }
    });
    return nextPeer;
  };

  const createClientPeer = (roomId: string): P2PPeer => {
    disposeTransport();
    const nextPeer = new options.Peer(undefined, options.peerOptions);
    peer = nextPeer;
    nextPeer.on('open', () => {
      if (peer !== nextPeer) return;
      try {
        const connection = nextPeer.connect(roomId);
        hostConnection = connection;
        setupConnection(connection);
      } catch (error) {
        log(`Join failed: ${String(error)}`, 'error');
        disposeTransport();
        scheduleReconnect('join-error');
      }
    });
    nextPeer.on('error', (error) => {
      if (peer !== nextPeer) return;
      log(`Join error: ${String(error)}`, 'error');
      disposeTransport();
      scheduleReconnect('peer-error');
    });
    return nextPeer;
  };

  const setupConnection = (connection: P2PDataConnection) => {
    connections.add(connection);
    let closed = false;
    let openTimeoutId: number | null = null;
    const clearOpenTimeout = () => {
      if (openTimeoutId === null) return;
      window.clearTimeout(openTimeoutId);
      openTimeoutId = null;
    };
    connection.on('open', () => {
      if (closed) return;
      clearOpenTimeout();
      reconnectAttempt = 0;
      clearReconnectTimer();
      void sendHello(connection);
      void options.onConnectionOpen?.(connection);
      void options.onConnectionChange?.(getOpenConnectionCount());
    });
    connection.on('data', (message: unknown) => {
      void (async () => {
        if (!isRecord(message) || typeof message.type !== 'string') {
          await options.onMessage?.(message, connection);
          return;
        }
        if (message.type === 'HELLO') {
          await requestMissing(connection, Array.isArray(message.metas) ? message.metas as Array<{ id: string; version: number }> : []);
          send(connection, { type: 'MY_METAS', metas: await options.adapter.listMetas() });
          return;
        }
        if (message.type === 'MY_METAS') {
          await requestMissing(connection, Array.isArray(message.metas) ? message.metas as Array<{ id: string; version: number }> : []);
          return;
        }
        if (message.type === 'REQUEST_ITEMS') {
          for (const id of Array.isArray(message.ids) ? message.ids : []) {
            if (typeof id !== 'string') continue;
            const item = await options.adapter.getItem(id);
            if (item) await sendItem(connection, item);
          }
          return;
        }
        const totalChunks = message.type === 'ITEM_START' && typeof message.totalChunks === 'number' ? message.totalChunks : null;
        if (message.type === 'ITEM_START' && typeof message.itemId === 'string' && totalChunks !== null && Number.isInteger(totalChunks) && totalChunks > 0 && isRecord(message.metadata)) {
          const key = keyFor(connection, message.itemId);
          clearIncoming(key);
          incoming.set(key, {
            chunks: new Array<ArrayBuffer>(totalChunks),
            total: totalChunks,
            metadata: message.metadata as IncomingTransfer['metadata'],
            timeoutId: window.setTimeout(() => {
              clearIncoming(key);
              log(`Timed out receiving ${message.itemId}`, 'error');
            }, incomingTtlMs),
          });
          return;
        }
        const chunkIndex = message.type === 'ITEM_CHUNK' && typeof message.index === 'number' ? message.index : null;
        if (message.type === 'ITEM_CHUNK' && typeof message.itemId === 'string' && chunkIndex !== null && Number.isInteger(chunkIndex) && message.chunk instanceof ArrayBuffer) {
          const key = keyFor(connection, message.itemId);
          const state = incoming.get(key);
          if (!state || chunkIndex < 0 || chunkIndex >= state.total || state.chunks[chunkIndex]) return;
          state.chunks[chunkIndex] = message.chunk;
          if (state.chunks.filter(Boolean).length === state.total) {
            clearIncoming(key);
            await options.adapter.upsertRemoteItem({
              id: state.metadata.id,
              version: state.metadata.version,
              meta: state.metadata.meta,
              payload: new Blob(state.chunks),
            });
          }
          return;
        }
        await options.onMessage?.(message, connection);
      })().catch((error) => log(`Message handling failed: ${String(error)}`, 'error'));
    });
    const cleanup = () => {
      if (closed) return;
      closed = true;
      connectionCleanups.delete(connection);
      clearOpenTimeout();
      for (const key of Array.from(incoming.keys())) {
        if (key.startsWith(`${connection.peer ?? 'unknown'}:`)) clearIncoming(key);
      }
      connections.delete(connection);
      if (hostConnection === connection) hostConnection = null;
      void options.onConnectionClose?.(connection);
      void options.onConnectionChange?.(getOpenConnectionCount());
      if (!disposing && desiredMode === 'client' && getOpenConnectionCount() === 0) scheduleReconnect('connection-closed');
    };
    connectionCleanups.set(connection, cleanup);
    connection.on('close', cleanup);
    connection.on('error', cleanup);
    openTimeoutId = window.setTimeout(() => {
      if (closed || connection.open) return;
      log(`Connection to ${connection.peer ?? 'unknown'} did not open in time`, 'error');
      try {
        connection.close();
      } catch (error) {
        log(`Failed to close unopened connection: ${String(error)}`, 'error');
      }
      cleanup();
    }, connectionOpenTimeoutMs);
  };

  const handleVisibilityChange = () => {
    if (lifecycleTarget?.visibilityState !== 'visible' || !desiredMode || hasUsableTransport()) return;
    scheduleReconnect('page-visible');
  };

  const ensureVisibilityBinding = () => {
    if (visibilityBound || options.bindVisibility === false || !lifecycleTarget?.addEventListener) return;
    lifecycleTarget.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityBound = true;
  };

  const isP2PConnection = (value: unknown): value is P2PDataConnection => isRecord(value) && typeof value.on === 'function' && typeof value.close === 'function' && typeof value.send === 'function';

  return {
    startHost(roomId) {
      stopping = false;
      desiredMode = 'host';
      desiredRoomId = roomId;
      reconnectAttempt = 0;
      clearReconnectTimer();
      ensureVisibilityBinding();
      return createHostPeer(roomId);
    },
    joinRoom(roomId) {
      stopping = false;
      desiredMode = 'client';
      desiredRoomId = roomId;
      reconnectAttempt = 0;
      clearReconnectTimer();
      ensureVisibilityBinding();
      return createClientPeer(roomId);
    },
    stop() {
      stopping = true;
      desiredMode = null;
      desiredRoomId = null;
      clearReconnectTimer();
      if (visibilityBound && lifecycleTarget?.removeEventListener) lifecycleTarget.removeEventListener('visibilitychange', handleVisibilityChange);
      visibilityBound = false;
      disposeTransport();
      broadcastedVersions.clear();
    },
    setupConnection,
    closeConnection(connection) {
      const cleanup = connectionCleanups.get(connection);
      if (!cleanup) return false;
      try {
        connection.close();
      } catch (error) {
        log(`Failed to close connection: ${String(error)}`, 'error');
      } finally {
        cleanup();
      }
      return true;
    },
    async broadcastLocalChanges() {
      const metas = await options.adapter.listMetas();
      for (const meta of metas) {
        if ((broadcastedVersions.get(meta.id) ?? 0) >= meta.version) continue;
        const item = await options.adapter.getItem(meta.id);
        if (!item) continue;
        let sentToAll = true;
        for (const connection of connections) {
          if (!connection.open) continue;
          try {
            sentToAll = (await sendItem(connection, item)) && sentToAll;
          } catch (error) {
            sentToAll = false;
            log(`Broadcast failed for ${item.id}: ${String(error)}`, 'error');
          }
        }
        if (sentToAll) broadcastedVersions.set(meta.id, meta.version);
      }
    },
    broadcast(message) {
      let sent = false;
      for (const connection of connections) sent = send(connection, message) || sent;
      return sent;
    },
    sendToHost(message) {
      return hostConnection ? send(hostConnection, message) : false;
    },
    sendToConnection: send,
    getConnectionCount: getOpenConnectionCount,
  };
};

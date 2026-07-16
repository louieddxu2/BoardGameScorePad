import { ScoreStateSyncAdapter, SyncItem } from './scoreStateSyncAdapter';

export interface P2PDataConnection {
  peer?: string;
  open: boolean;
  send(data: unknown): void;
  close(): void;
  on(event: 'open' | 'close' | 'error' | 'data', handler: (value?: any) => void): void;
}

export interface P2PPeer {
  connect(peerId: string): P2PDataConnection;
  destroy(): void;
  on(event: 'open' | 'connection' | 'error', handler: (value?: any) => void): void;
}

export type P2PPeerConstructor = new (id?: string, options?: unknown) => P2PPeer;

export interface P2PHandshakeSync {
  startHost(roomId: string): P2PPeer;
  joinRoom(roomId: string): P2PPeer;
  stop(): void;
  setupConnection(connection: P2PDataConnection): void;
  broadcastLocalChanges(): Promise<void>;
  broadcast(message: unknown): boolean;
  sendToHost(message: unknown): boolean;
  sendToConnection(connection: P2PDataConnection, message: unknown): boolean;
  getConnectionCount(): number;
}

const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object';

/** Generic metadata-first handshake. Domain messages are passed through unchanged. */
export const createP2PHandshakeSync = (options: {
  Peer: P2PPeerConstructor;
  adapter: ScoreStateSyncAdapter;
  peerOptions?: unknown;
  chunkSize?: number;
  onMessage?: (message: unknown, connection: P2PDataConnection) => void | Promise<void>;
  onConnectionOpen?: (connection: P2PDataConnection) => void | Promise<void>;
  onConnectionClose?: (connection: P2PDataConnection) => void | Promise<void>;
  onConnectionChange?: (connectionCount: number) => void | Promise<void>;
  logger?: (message: string, level?: 'info' | 'error') => void;
}): P2PHandshakeSync => {
  const chunkSize = options.chunkSize ?? 16 * 1024;
  const connections = new Set<P2PDataConnection>();
  const incoming = new Map<string, { chunks: ArrayBuffer[]; total: number; metadata: { id: string; version: number; meta?: Record<string, unknown> } }>();
  let peer: P2PPeer | null = null;
  let hostConnection: P2PDataConnection | null = null;

  const send = (connection: P2PDataConnection, message: unknown) => {
    if (!connection.open) return false;
    connection.send(message);
    return true;
  };
  const keyFor = (connection: P2PDataConnection, id: string) => `${connection.peer ?? 'unknown'}:${id}`;
  const sendItem = async (connection: P2PDataConnection, item: SyncItem) => {
    if (!connection.open) return;
    const buffer = await item.payload.arrayBuffer();
    const total = Math.max(1, Math.ceil(buffer.byteLength / chunkSize));
    send(connection, { type: 'ITEM_START', itemId: item.id, totalChunks: total, metadata: { id: item.id, version: item.version, meta: item.meta ?? {} } });
    for (let index = 0; index < total; index += 1) {
      send(connection, { type: 'ITEM_CHUNK', itemId: item.id, index, chunk: buffer.slice(index * chunkSize, Math.min(buffer.byteLength, (index + 1) * chunkSize)) });
    }
  };
  const requestMissing = async (connection: P2PDataConnection, remote: Array<{ id: string; version: number }>) => {
    const local = await options.adapter.listMetas();
    const localVersions = new Map(local.map((meta) => [meta.id, meta.version]));
    const ids = remote.filter((meta) => (localVersions.get(meta.id) ?? -1) < meta.version).map((meta) => meta.id);
    if (ids.length) send(connection, { type: 'REQUEST_ITEMS', ids });
  };
  const sendHello = async (connection: P2PDataConnection) => {
    send(connection, { type: 'HELLO', scope: options.adapter.getScope(), metas: await options.adapter.listMetas() });
  };
  const setupConnection = (connection: P2PDataConnection) => {
    connections.add(connection);
    connection.on('open', () => {
      void sendHello(connection);
      void options.onConnectionOpen?.(connection);
      void options.onConnectionChange?.(connections.size);
    });
    connection.on('data', (message: unknown) => {
      void (async () => {
        if (!isRecord(message) || typeof message.type !== 'string') return;
        if (message.type === 'HELLO') { await requestMissing(connection, Array.isArray(message.metas) ? message.metas : []); send(connection, { type: 'MY_METAS', metas: await options.adapter.listMetas() }); return; }
        if (message.type === 'MY_METAS') { await requestMissing(connection, Array.isArray(message.metas) ? message.metas : []); return; }
        if (message.type === 'REQUEST_ITEMS') { for (const id of Array.isArray(message.ids) ? message.ids : []) { const item = await options.adapter.getItem(id); if (item) await sendItem(connection, item); } return; }
        if (message.type === 'ITEM_START' && typeof message.itemId === 'string' && Number.isInteger(message.totalChunks) && message.totalChunks > 0 && isRecord(message.metadata)) {
          incoming.set(keyFor(connection, message.itemId), { chunks: new Array(message.totalChunks), total: message.totalChunks, metadata: message.metadata as any }); return;
        }
        if (message.type === 'ITEM_CHUNK' && typeof message.itemId === 'string' && Number.isInteger(message.index) && message.chunk instanceof ArrayBuffer) {
          const key = keyFor(connection, message.itemId); const state = incoming.get(key); if (!state || message.index < 0 || message.index >= state.total || state.chunks[message.index]) return;
          state.chunks[message.index] = message.chunk;
          if (state.chunks.filter(Boolean).length === state.total) { incoming.delete(key); await options.adapter.upsertRemoteItem({ id: state.metadata.id, version: state.metadata.version, meta: state.metadata.meta, payload: new Blob(state.chunks) }); }
          return;
        }
        await options.onMessage?.(message, connection);
      })().catch((error) => options.logger?.(String(error), 'error'));
    });
    const cleanup = () => {
      connections.delete(connection);
      if (hostConnection === connection) hostConnection = null;
      void options.onConnectionClose?.(connection);
      void options.onConnectionChange?.(connections.size);
    };
    connection.on('close', cleanup); connection.on('error', cleanup);
  };
  const stop = () => { for (const connection of connections) connection.close(); connections.clear(); incoming.clear(); if (peer) peer.destroy(); peer = null; hostConnection = null; };
  return {
    startHost(roomId) { stop(); peer = new options.Peer(roomId, options.peerOptions); peer.on('connection', setupConnection); peer.on('error', (error) => options.logger?.(String(error), 'error')); return peer; },
    joinRoom(roomId) { stop(); peer = new options.Peer(undefined, options.peerOptions); peer.on('open', () => { hostConnection = peer!.connect(roomId); setupConnection(hostConnection); }); peer.on('error', (error) => options.logger?.(String(error), 'error')); return peer; },
    stop,
    setupConnection,
    async broadcastLocalChanges() { const metas = await options.adapter.listMetas(); for (const meta of metas) { const item = await options.adapter.getItem(meta.id); if (item) for (const connection of connections) await sendItem(connection, item); } },
    broadcast(message) { let sent = false; for (const connection of connections) sent = send(connection, message) || sent; return sent; },
    sendToHost(message) { return hostConnection ? send(hostConnection, message) : false; },
    sendToConnection: send,
    getConnectionCount: () => connections.size,
  };
};

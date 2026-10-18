import { afterEach, describe, expect, it, vi } from 'vitest';
import { util } from 'peerjs';
import { P2PDataConnection, P2PPeer, createP2PHandshakeSync } from './p2pHandshakeSync';
import { createMultiplayerP2PRuntimeTransport } from './multiplayerP2PRuntimeTransport';
import { readSyncItemPayload, SyncItem } from './scoreStateSyncAdapter';

class FakeConnection implements P2PDataConnection {
  open = false;
  sent: unknown[] = [];
  private readonly handlers = new Map<string, (value?: unknown) => void>();

  constructor(public readonly peer?: string) {}

  on(event: 'open' | 'close' | 'error' | 'data', handler: (value?: unknown) => void) {
    this.handlers.set(event, handler);
  }

  emit(event: 'open' | 'close' | 'error' | 'data', value?: unknown) {
    this.handlers.get(event)?.(value);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.open = false;
    this.emit('close');
  }
}

class FakePeer implements P2PPeer {
  static instances: FakePeer[] = [];
  destroyed = false;
  connections: FakeConnection[] = [];
  private readonly handlers = new Map<string, (value?: unknown) => void>();

  constructor(public readonly id?: string) {
    FakePeer.instances.push(this);
  }

  on(event: 'open' | 'connection' | 'error', handler: (value?: unknown) => void) {
    this.handlers.set(event, handler);
  }

  emit(event: 'open' | 'connection' | 'error', value?: unknown) {
    this.handlers.get(event)?.(value);
  }

  connect(peerId: string) {
    const connection = new FakeConnection(peerId);
    this.connections.push(connection);
    return connection;
  }

  destroy() {
    this.destroyed = true;
  }
}

const createAdapter = () => ({
  getScope: () => ({ sessionStart: 0, roomKey: 'room-1' }),
  listMetas: async () => [],
  getItem: async () => null,
  upsertRemoteItem: async () => undefined,
});

const openClientConnection = async (peer: FakePeer) => {
  peer.emit('open');
  const connection = peer.connections[0];
  connection.open = true;
  connection.emit('open');
  await Promise.resolve();
  return connection;
};

describe('createP2PHandshakeSync reconnect lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    FakePeer.instances = [];
  });

  it('receives large transfers after real PeerJS decoding turns internally reassembled chunks into byte views', async () => {
    const text = JSON.stringify({ name: 'Large board', inputs: 'x'.repeat(40_000) });
    const payload = Uint8Array.from(new TextEncoder().encode(text)).buffer;
    const item: SyncItem = { id: 'session-1', version: 2,
      payload: Object.assign(new Blob(), { arrayBuffer: async () => payload }) };
    let receivedText: string | undefined;
    const upsertRemoteItem = vi.fn(async (received: SyncItem) => {
      receivedText = await readSyncItemPayload(received.payload);
    });
    const sender = createP2PHandshakeSync({ Peer: FakePeer, adapter: createAdapter() });
    const receiver = createP2PHandshakeSync({ Peer: FakePeer, adapter: { ...createAdapter(), upsertRemoteItem } });
    const outgoing = new FakeConnection('player');
    const incoming = new FakeConnection('host');
    sender.setupConnection(outgoing);
    receiver.setupConnection(incoming);
    outgoing.open = true;
    incoming.open = true;
    try {
      await sender.broadcastLocalChanges(item);
      let byteViewChunks = 0;
      for (const packet of outgoing.sent) {
        const bytes = await util.pack(packet as Parameters<typeof util.pack>[0]);
        // PeerJS's binary connection rejoins packets above its 16,300-byte MTU
        // as Uint8Array, then passes that view to this same public unpacker.
        const wire = bytes.byteLength > 16_300 ? new Uint8Array(bytes) : bytes;
        const decoded = util.unpack(wire as ArrayBuffer) as unknown as { type: string; chunk?: unknown };
        if (decoded.type === 'ITEM_CHUNK' && decoded.chunk instanceof Uint8Array) {
          byteViewChunks++;
          if (byteViewChunks === 1) {
            // A view must not import unrelated bytes from its backing buffer.
            const padded = new Uint8Array(decoded.chunk.byteLength + 4).fill(255);
            padded.set(decoded.chunk, 2);
            decoded.chunk = padded.subarray(2, -2);
          }
        }
        incoming.emit('data', decoded);
      }
      expect(byteViewChunks).toBe(2); // The last, smaller chunk stays ArrayBuffer.
      await vi.waitFor(() => expect(receivedText).toBeDefined(), { timeout: 500 });
      expect(receivedText === text, 'Every payload byte must survive both binary decoding paths').toBe(true);
      expect(upsertRemoteItem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: item.id, version: item.version }));
    } finally {
      sender.stop();
      receiver.stop();
    }
  });

  it('reports a partial transfer failure and retries the same frozen revision without rereading the adapter', async () => {
    const adapter = { ...createAdapter(), getItem: vi.fn(async () => null) };
    const sync = createP2PHandshakeSync({ Peer: FakePeer, adapter });
    sync.startHost('room-1');
    const failed = new FakeConnection('failed');
    const healthy = new FakeConnection('healthy');
    for (const connection of [failed, healthy]) {
      sync.setupConnection(connection);
      connection.open = true;
      connection.emit('open');
    }
    await Promise.resolve();
    const item: SyncItem = { id: 'session-1', version: 2, payload: Object.assign(new Blob(), { arrayBuffer: async () => new ArrayBuffer(1) }) };
    const send = vi.spyOn(failed, 'send').mockImplementationOnce(() => { throw new Error('channel failure'); });
    await expect(sync.broadcastLocalChanges(item)).rejects.toThrow('score_state_broadcast_failed');
    expect(healthy.sent).toContainEqual(expect.objectContaining({ type: 'ITEM_CHUNK' }));
    await sync.broadcastLocalChanges(item);
    expect(failed.sent).toContainEqual(expect.objectContaining({ type: 'ITEM_CHUNK' }));
    const sentCount = healthy.sent.length;
    await sync.broadcastLocalChanges(item);
    expect(healthy.sent).toHaveLength(sentCount);
    expect(adapter.getItem).not.toHaveBeenCalled();
    send.mockRestore();
    sync.stop();
  });

  it('finishes initial template chunks before an automatic transfer while allowing ordinary score messages', async () => {
    vi.useFakeTimers();
    const item = (version: number): SyncItem => ({ id: 'session-1', version,
      payload: Object.assign(new Blob(), { arrayBuffer: async () => new ArrayBuffer(12) }),
    });
    const sync = createP2PHandshakeSync({ Peer: FakePeer, adapter: { ...createAdapter(), getItem: async () => item(1) }, chunkSize: 2 });
    sync.startHost('room-1');
    const connection = new FakeConnection('player');
    sync.setupConnection(connection);
    connection.open = true;
    connection.emit('open');
    await Promise.resolve();
    connection.sent.length = 0;
    connection.emit('data', { type: 'REQUEST_ITEMS', ids: ['session-1'] });
    await vi.advanceTimersByTimeAsync(0);
    const automatic = sync.broadcastLocalChanges(item(2));
    sync.broadcast({ type: 'session:snapshot', revision: 3 });
    expect(connection.sent).toContainEqual({ type: 'session:snapshot', revision: 3 });
    await vi.advanceTimersByTimeAsync(100);
    await automatic;
    const packets = connection.sent.filter(message => (message as { type: string }).type.startsWith('ITEM_')) as Array<{ type: string; index?: number; metadata?: { version: number } }>;
    expect(packets.map(packet => packet.type === 'ITEM_START' ? `start:${packet.metadata!.version}` : packet.index)).toEqual([
      'start:1', 0, 1, 2, 3, 4, 5, 'start:2', 0, 1, 2, 3, 4, 5,
    ]);
    sync.stop();
  });

  it('forwards source exclusion through the runtime transport without changing ordinary broadcasts', async () => {
    const adapter = { ...createAdapter(), stop: vi.fn() };
    const transport = createMultiplayerP2PRuntimeTransport({ Peer: FakePeer, adapter });
    transport.startHost?.('room-1');
    const source = new FakeConnection('source');
    const other = new FakeConnection('other');
    for (const connection of [source, other]) {
      FakePeer.instances[0].emit('connection', connection);
      connection.open = true;
      connection.emit('open');
    }
    await Promise.resolve();
    source.sent.length = 0;
    other.sent.length = 0;
    const snapshot = { type: 'session:snapshot', revision: 2 };
    const acknowledgement = { type: 'score:patch-result', opId: 'op-1', accepted: true, snapshot };

    expect(transport.sendToConnection(source, acknowledgement)).toBe(true);
    expect(transport.broadcastMessage?.(snapshot, source)).toBe(true);
    expect(source.sent).toEqual([acknowledgement]);
    expect(other.sent).toEqual([snapshot]);

    const hostSnapshot = { ...snapshot, revision: 3 };
    expect(transport.broadcastMessage?.(hostSnapshot)).toBe(true);
    expect(source.sent).toEqual([acknowledgement, hostSnapshot]);
    expect(other.sent).toEqual([snapshot, hostSnapshot]);

    other.close();
    expect(transport.broadcastMessage?.(snapshot, source)).toBe(false);
    expect(source.sent).toEqual([acknowledgement, hostSnapshot]);
    transport.stop?.();
    expect(adapter.stop).toHaveBeenCalledOnce();
    const peerCount = FakePeer.instances.length;
    const lateHandler = vi.fn();
    transport.setConnectionChangeHandler?.(lateHandler);
    transport.joinRoom?.('room-1');
    transport.startHost?.('room-1');
    transport.stop?.();
    expect(lateHandler).not.toHaveBeenCalled();
    expect(FakePeer.instances).toHaveLength(peerCount);
    expect(adapter.stop).toHaveBeenCalledOnce();
  });

  it('reconnects a client, repeats HELLO, and preserves raw message routing', async () => {
    vi.useFakeTimers();
    const onMessage = vi.fn();
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      onMessage,
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      bindVisibility: false,
    });

    sync.joinRoom('room-1');
    const firstConnection = await openClientConnection(FakePeer.instances[0]);
    expect(firstConnection.sent[0]).toEqual(expect.objectContaining({ type: 'HELLO' }));

    firstConnection.close();
    await vi.advanceTimersByTimeAsync(1);
    expect(FakePeer.instances).toHaveLength(2);

    const secondConnection = await openClientConnection(FakePeer.instances[1]);
    expect(secondConnection.sent[0]).toEqual(expect.objectContaining({ type: 'HELLO' }));
    secondConnection.emit('data', { type: 'MY_METAS', metas: [{ id: 'session-1', version: 2 }] });
    await Promise.resolve();
    expect(secondConnection.sent).toContainEqual({ type: 'REQUEST_ITEMS', ids: ['session-1'] });
    secondConnection.emit('data', { type: 'score:valuePatch', opId: 'patch-1' });
    await Promise.resolve();
    expect(onMessage).toHaveBeenCalledWith({ type: 'score:valuePatch', opId: 'patch-1' }, secondConnection);
    sync.stop();
  });

  it('requests the host snapshot on the first join even when local metadata has the same revision', async () => {
    const adapter = {
      ...createAdapter(),
      listMetas: async () => [{ id: 'session-1', version: 3 }],
    };
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter,
      forceInitialSync: true,
      bindVisibility: false,
    });

    sync.joinRoom('room-1');
    const connection = await openClientConnection(FakePeer.instances[0]);
    connection.emit('data', { type: 'MY_METAS', metas: [{ id: 'session-1', version: 3 }] });
    await Promise.resolve();

    expect(connection.sent).toContainEqual({ type: 'REQUEST_ITEMS', ids: ['session-1'] });
    const requestCount = connection.sent.filter((message) => (message as { type?: string }).type === 'REQUEST_ITEMS').length;
    connection.emit('data', { type: 'MY_METAS', metas: [{ id: 'session-1', version: 3 }] });
    await Promise.resolve();
    expect(connection.sent.filter((message) => (message as { type?: string }).type === 'REQUEST_ITEMS')).toHaveLength(requestCount);
    sync.stop();
  });

  it('cancels scheduled reconnect attempts after an explicit stop', async () => {
    vi.useFakeTimers();
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      bindVisibility: false,
    });

    sync.joinRoom('room-1');
    const connection = await openClientConnection(FakePeer.instances[0]);
    connection.close();
    sync.stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(FakePeer.instances).toHaveLength(1);
  });

  it('ignores late data and open events even if closing the channel emits no close event', async () => {
    vi.useFakeTimers();
    const adapter = { ...createAdapter(), listMetas: vi.fn(async () => []), upsertRemoteItem: vi.fn() };
    const onMessage = vi.fn();
    const onConnectionOpen = vi.fn();
    const sync = createP2PHandshakeSync({ Peer: FakePeer, adapter, onMessage, onConnectionOpen });
    sync.joinRoom('room-1');
    const connection = await openClientConnection(FakePeer.instances[0]);
    vi.spyOn(connection, 'close').mockImplementation(() => {});
    sync.stop();
    adapter.listMetas.mockClear();
    onConnectionOpen.mockClear();
    const sentCount = connection.sent.length;
    connection.emit('open');
    connection.emit('data', { type: 'score:valuePatch', opId: 'late' });
    connection.emit('data', { type: 'HELLO', metas: [] });
    connection.emit('data', { type: 'ITEM_START', itemId: 'late', totalChunks: 1, metadata: { id: 'late', version: 1 } });
    connection.emit('data', { type: 'ITEM_CHUNK', itemId: 'late', index: 0, chunk: new ArrayBuffer(1) });
    await vi.runAllTimersAsync();
    expect(onMessage).not.toHaveBeenCalled();
    expect(onConnectionOpen).not.toHaveBeenCalled();
    expect(adapter.listMetas).not.toHaveBeenCalled();
    expect(adapter.upsertRemoteItem).not.toHaveBeenCalled();
    expect(connection.sent).toHaveLength(sentCount);
    expect(sync.sendToConnection(connection, { type: 'late' })).toBe(false);
    expect(FakePeer.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes a specific connection and updates the connection count', async () => {
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      bindVisibility: false,
    });

    sync.joinRoom('room-1');
    const connection = await openClientConnection(FakePeer.instances[0]);
    expect(sync.getConnectionCount()).toBe(1);

    expect(sync.closeConnection(connection)).toBe(true);
    expect(sync.getConnectionCount()).toBe(0);
    expect(sync.closeConnection(connection)).toBe(false);
    sync.stop();
  });

  it('retries when a replacement data connection never opens', async () => {
    vi.useFakeTimers();
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      connectionOpenTimeoutMs: 5,
      bindVisibility: false,
    });

    sync.joinRoom('room-1');
    const firstConnection = await openClientConnection(FakePeer.instances[0]);
    firstConnection.close();
    await vi.advanceTimersByTimeAsync(1);

    const stalledPeer = FakePeer.instances[1];
    stalledPeer.emit('open');
    expect(sync.getConnectionCount()).toBe(0);
    expect(stalledPeer.connections).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakePeer.instances).toHaveLength(3);
    sync.stop();
  });

  it('does not recreate a failed host peer when automatic reconnect is disabled', async () => {
    vi.useFakeTimers();
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      autoReconnect: false,
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      bindVisibility: false,
    });

    sync.startHost('room-1');
    FakePeer.instances[0].emit('error', new Error('network failure'));
    await vi.advanceTimersByTimeAsync(10);
    expect(FakePeer.instances).toHaveLength(1);
    sync.stop();
  });

  it('retries when a suspended client returns to a visible page without a connection', async () => {
    vi.useFakeTimers();
    let visibilityListener: (() => void) | undefined;
    const lifecycle = {
      visibilityState: 'hidden',
      addEventListener: vi.fn((_event: 'visibilitychange', listener: () => void) => { visibilityListener = listener; }),
      removeEventListener: vi.fn(),
    };
    const sync = createP2PHandshakeSync({
      Peer: FakePeer,
      adapter: createAdapter(),
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      lifecycleTarget: lifecycle,
    });

    sync.joinRoom('room-1');
    lifecycle.visibilityState = 'visible';
    visibilityListener?.();
    await vi.advanceTimersByTimeAsync(1);
    expect(FakePeer.instances).toHaveLength(2);
    sync.stop();
    expect(lifecycle.removeEventListener).toHaveBeenCalledOnce();
  });
});

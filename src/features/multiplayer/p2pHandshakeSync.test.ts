import { afterEach, describe, expect, it, vi } from 'vitest';
import { P2PDataConnection, P2PPeer, createP2PHandshakeSync } from './p2pHandshakeSync';

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
    FakePeer.instances = [];
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
    secondConnection.emit('data', { type: 'score:valuePatch', opId: 'patch-1' });
    await Promise.resolve();
    expect(onMessage).toHaveBeenCalledWith({ type: 'score:valuePatch', opId: 'patch-1' }, secondConnection);
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

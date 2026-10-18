import type { util } from 'peerjs';
import type { P2PDataConnection, P2PPeer } from '../features/multiplayer/p2pHandshakeSync';

type TestPacket = { from: string; to: string; message: unknown };
type PacketGate = {
  matches: (packet: TestPacket) => boolean;
  blockedChannels: Set<string>;
  deliveries: Array<(deliverAfterClose: boolean) => void>;
};

/** In-process transport only: application handshakes, chunks and codecs stay real. */
export const createPeerNetwork = (codec: Pick<typeof util, 'pack' | 'unpack'>) => {
  const peers = new Map<string, Peer>();
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  const packets: string[] = [];
  const gates = new Set<PacketGate>();
  let nextId = 0;

  class Connection implements P2PDataConnection {
    open = false;
    other!: Connection;
    private closed = false;
    private handlers = new Map<string, (value?: unknown) => void>();
    constructor(public peer: string, readonly owner: string) {}
    on(event: 'open' | 'close' | 'error' | 'data', handler: (value?: unknown) => void) { this.handlers.set(event, handler); }
    emit(event: string, value?: unknown) { this.handlers.get(event)?.(value); }
    send(message: unknown) {
      if (!this.open || this.closed) throw new Error('test_channel_closed');
      packets.push(String((message as { type?: string }).type));
      const task = Promise.resolve(codec.pack(message as Parameters<typeof codec.pack>[0])).then(bytes => {
        if (!(bytes instanceof ArrayBuffer)) throw new Error('test_packet_must_be_binary');
        const decoded: unknown = codec.unpack(bytes);
        const deliver = (deliverAfterClose = false) => {
          if (this.other.open || deliverAfterClose) this.other.emit('data', decoded);
        };
        const packet = { from: this.owner, to: this.peer, message: decoded };
        const channel = `${this.owner}:${this.peer}`;
        for (const gate of gates) {
          // Once blocked, retain subsequent messages in the same direction too:
          // delaying a reliable ordered channel must not reorder its packets.
          if (!gate.blockedChannels.has(channel) && !gate.matches(packet)) continue;
          gate.blockedChannels.add(channel);
          gate.deliveries.push(deliver);
          return;
        }
        deliver();
      });
      pending.add(task);
      void task.then(() => pending.delete(task), error => { errors.push(error); pending.delete(task); });
    }
    activate() { if (!this.closed) { this.open = true; this.emit('open'); } }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      this.emit('close');
      this.other.close();
    }
  }

  class Peer implements P2PPeer {
    destroyed = false;
    readonly id: string;
    private handlers = new Map<string, (value?: unknown) => void>();
    private connections: Connection[] = [];
    constructor(id?: string) {
      this.id = id ?? `test-peer-${++nextId}`;
      if (peers.has(this.id)) throw new Error('test_peer_id_taken');
      peers.set(this.id, this);
      queueMicrotask(() => { if (!this.destroyed) this.handlers.get('open')?.(this.id); });
    }
    on(event: 'open' | 'connection' | 'error', handler: (value?: unknown) => void) { this.handlers.set(event, handler); }
    connect(id: string) {
      const target = peers.get(id);
      if (!target || target.destroyed) throw new Error(`test_missing_peer:${id}`);
      const local = new Connection(id, this.id);
      const remote = new Connection(this.id, id);
      local.other = remote;
      remote.other = local;
      this.connections.push(local);
      target.connections.push(remote);
      target.handlers.get('connection')?.(remote);
      queueMicrotask(() => { remote.activate(); local.activate(); });
      return local;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      peers.delete(this.id);
      for (const connection of this.connections) connection.close();
    }
  }

  return {
    Peer,
    errors,
    packets,
    get peerCount() { return peers.size; },
    holdPackets(matches: (packet: TestPacket) => boolean) {
      const gate: PacketGate = { matches, blockedChannels: new Set(), deliveries: [] };
      gates.add(gate);
      return {
        get heldCount() { return gate.deliveries.length; },
        release(options?: { deliverAfterClose?: boolean }) {
          gates.delete(gate);
          for (const deliver of gate.deliveries.splice(0)) deliver(options?.deliverAfterClose === true);
        },
      };
    },
    async flush() {
      for (let wave = 0; pending.size; wave++) {
        if (wave > 100) throw new Error('test_transport_did_not_settle');
        await Promise.all([...pending]);
      }
      if (errors.length) throw errors[0];
    },
    close() {
      for (const peer of [...peers.values()]) peer.destroy();
      // Teardown discards held packets rather than leaking deliveries into the
      // next scenario. Serializations already queued still see closed peers.
      for (const gate of gates) gate.deliveries.length = 0;
      gates.clear();
    },
  };
};

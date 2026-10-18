import { expect, it } from 'vitest';
import { util } from 'peerjs';
import { createPeerNetwork } from './peerNetworkFixture';
import type { P2PDataConnection } from '../features/multiplayer/p2pHandshakeSync';

it.each([false, true])('holds ordered packets in one direction; queued callback after close: %s', async deliverAfterClose => {
  const network = createPeerNetwork(util);
  try {
    const host = new network.Peer('host');
    const client = new network.Peer('client');
    const received: unknown[] = [];
    const replies: unknown[] = [];
    let incoming: P2PDataConnection | undefined;
    host.on('connection', value => {
      incoming = value as P2PDataConnection;
      incoming.on('data', message => received.push(message));
    });
    const outgoing = client.connect('host');
    outgoing.on('data', message => replies.push(message));
    await network.flush();
    const gate = network.holdPackets(packet => packet.from === 'client'
      && (packet.message as { type: string }).type === 'held');
    outgoing.send({ type: 'held', value: 1 });
    outgoing.send({ type: 'following', value: 2 });
    incoming!.send({ type: 'reply', value: 3 });
    await network.flush();
    expect(gate.heldCount).toBe(2);
    expect(received).toEqual([]);
    expect(replies).toEqual([{ type: 'reply', value: 3 }]);
    gate.release();
    expect(received).toEqual([{ type: 'held', value: 1 }, { type: 'following', value: 2 }]);

    const closedGate = network.holdPackets(packet => packet.from === 'client');
    outgoing.send({ type: 'before-close', value: 4 });
    await network.flush();
    expect(closedGate.heldCount).toBe(1);
    outgoing.close();
    closedGate.release({ deliverAfterClose });
    expect(received).toHaveLength(deliverAfterClose ? 3 : 2);
    expect(closedGate.heldCount).toBe(0);
    expect(network.errors).toEqual([]);
  } finally {
    network.close();
  }
});

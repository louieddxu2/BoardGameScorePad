import type { P2PPeerConstructor } from '../features/multiplayer/p2pHandshakeSync';
import { createMultiplayerP2PRuntimeTransport } from '../features/multiplayer/multiplayerP2PRuntimeTransport';
import { createScoreStateSyncAdapter } from '../features/multiplayer/scoreStateSyncAdapter';
import { createMultiplayerPlayerRoomRuntime } from '../features/multiplayer/multiplayerRoomRuntime';
import { createBindingStore, createDeliveryStore, createRuntimeStore } from './multiplayerRuntimeFixture';

/** The two non-UI participants use the same stores/controllers as the existing simulation. */
export const createHeadlessParticipant = (Peer: P2PPeerConstructor, roomId: string, playerId: string) => {
  const store = createRuntimeStore();
  const deliveryStore = createDeliveryStore();
  const bindingStore = createBindingStore();
  let runtime: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>> | undefined;
  let creation: Promise<NonNullable<typeof runtime>> | undefined;
  const adapter = createScoreStateSyncAdapter({ roomId, role: 'player', store: {
    ...store,
    async applyRemoteBootstrap(message, isActive) {
      if (!isActive()) return;
      if (creation) {
        const existing = await creation;
        if (isActive()) await existing.receive(message);
        return;
      }
      creation = createMultiplayerPlayerRoomRuntime({ bootstrapMessage: message,
        deviceId: `headless-${playerId}`, store, deliveryStore, bindingStore, transport });
      runtime = await creation;
      if (!isActive()) { runtime.stop(); return; }
      runtime.controller.claimPlayer(playerId);
    },
  } });
  const transport = createMultiplayerP2PRuntimeTransport({ Peer, adapter });
  transport.joinRoom?.(roomId);
  return { transport, get runtime() { return runtime; } };
};

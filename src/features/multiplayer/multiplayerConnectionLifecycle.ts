import { generateId } from '../../utils/idGenerator';

export type MultiplayerLifecyclePhase =
  | 'idle'
  | 'connecting'
  | 'selecting-players'
  | 'awaiting-claims'
  | 'online'
  | 'reconnecting'
  | 'failed';

export type MultiplayerLifecycleSnapshot = {
  phase: MultiplayerLifecyclePhase;
  roomId: string | null;
  generation: string | null;
};

export type MultiplayerLifecycleCommand =
  | { type: 'connect'; roomId: string; generation: string }
  | { type: 'disconnect'; generation: string }
  | { type: 'reconnect'; roomId: string; generation: string }
  | { type: 'join-timeout'; generation: string }
  | { type: 'navigate-dashboard' }
  | { type: 'show-takeover-notice' };

/**
 * Pure lifecycle authority for participant rooms. Transport callbacks carry a
 * generation so events from replaced QR attempts cannot mutate the new room.
 */
export const createMultiplayerConnectionLifecycle = (options?: {
  joinDeadlineMs?: number;
  createGeneration?: () => string;
}) => {
  const joinDeadlineMs = options?.joinDeadlineMs ?? 3_000;
  const createGeneration = options?.createGeneration ?? generateId;
  let now = 0;
  let joinDeadline: number | null = null;
  let snapshot: MultiplayerLifecycleSnapshot = { phase: 'idle', roomId: null, generation: null };
  let commands: MultiplayerLifecycleCommand[] = [];

  const isCurrent = (generation: string) => snapshot.generation === generation;
  const disconnectCurrent = () => {
    if (snapshot.generation) commands.push({ type: 'disconnect', generation: snapshot.generation });
  };
  const beginConnection = (roomId: string) => {
    disconnectCurrent();
    const generation = createGeneration();
    snapshot = { phase: 'connecting', roomId, generation };
    joinDeadline = now + joinDeadlineMs;
    commands.push({ type: 'connect', roomId, generation });
    return generation;
  };
  const returnToIdle = (extraCommands: MultiplayerLifecycleCommand[] = []) => {
    disconnectCurrent();
    snapshot = { phase: 'idle', roomId: null, generation: null };
    joinDeadline = null;
    commands.push(...extraCommands);
  };

  return {
    scanQr: beginConnection,
    resumeSession: beginConnection,
    transportOpened(generation: string) {
      if (!isCurrent(generation) || snapshot.phase !== 'connecting') return;
      // Bootstrap, rather than the PeerJS open event, advances readiness.
    },
    bootstrapReceived(generation: string) {
      if (!isCurrent(generation) || !['connecting', 'reconnecting'].includes(snapshot.phase)) return;
      snapshot = { ...snapshot, phase: 'selecting-players' };
      joinDeadline = null;
    },
    playersConfirmed(generation: string) {
      if (!isCurrent(generation) || snapshot.phase !== 'selecting-players') return;
      snapshot = { ...snapshot, phase: 'awaiting-claims' };
    },
    claimsAccepted(generation: string) {
      if (!isCurrent(generation) || snapshot.phase !== 'awaiting-claims') return;
      snapshot = { ...snapshot, phase: 'online' };
      joinDeadline = null;
    },
    connectionClosed(generation: string) {
      if (!isCurrent(generation) || snapshot.phase !== 'online' || !snapshot.roomId) return;
      const roomId = snapshot.roomId;
      snapshot = { ...snapshot, phase: 'reconnecting' };
      commands.push({ type: 'reconnect', roomId, generation });
    },
    pageReloaded() {
      if (snapshot.phase === 'idle') return;
      returnToIdle();
    },
    sessionDeleted(roomId: string) {
      if (snapshot.roomId !== roomId) return;
      returnToIdle([{ type: 'navigate-dashboard' }]);
    },
    tabSuperseded(generation: string) {
      if (!isCurrent(generation)) return;
      returnToIdle([{ type: 'navigate-dashboard' }, { type: 'show-takeover-notice' }]);
    },
    advanceTo(nextNow: number) {
      if (nextNow < now) throw new Error('multiplayer_lifecycle_clock_cannot_move_backwards');
      now = nextNow;
      if (joinDeadline === null || now <= joinDeadline || !snapshot.generation) return;
      const generation = snapshot.generation;
      commands.push({ type: 'disconnect', generation }, { type: 'join-timeout', generation });
      snapshot = { ...snapshot, phase: 'failed' };
      joinDeadline = null;
    },
    getSnapshot: () => ({ ...snapshot }),
    drainCommands() {
      const drained = commands;
      commands = [];
      return drained;
    },
  };
};

export type MultiplayerConnectionLifecycle = ReturnType<typeof createMultiplayerConnectionLifecycle>;

import { describe, expect, it } from 'vitest';
import { createMultiplayerConnectionLifecycle } from './multiplayerConnectionLifecycle';

describe('multiplayer connection acceptance contract', () => {
  it('requires the first bootstrap to reach player selection within three seconds', () => {
    const lifecycle = createMultiplayerConnectionLifecycle({ joinDeadlineMs: 3_000 });
    const generation = lifecycle.scanQr('room-1');

    lifecycle.advanceTo(2_999);
    lifecycle.bootstrapReceived(generation);

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'selecting-players', roomId: 'room-1', generation });
    expect(lifecycle.drainCommands()).not.toContainEqual(expect.objectContaining({ type: 'join-timeout' }));
  });

  it('fails explicitly instead of waiting forever when player selection misses the deadline', () => {
    const lifecycle = createMultiplayerConnectionLifecycle({ joinDeadlineMs: 3_000 });
    const generation = lifecycle.scanQr('room-1');

    lifecycle.advanceTo(3_001);

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'failed', generation });
    expect(lifecycle.drainCommands()).toEqual(expect.arrayContaining([
      { type: 'disconnect', generation },
      { type: 'join-timeout', generation },
    ]));
  });

  it('keeps a successful first connection online without an unsolicited reconnect', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    const generation = lifecycle.scanQr('room-1');
    lifecycle.transportOpened(generation);
    lifecycle.bootstrapReceived(generation);
    lifecycle.playersConfirmed(generation);
    lifecycle.claimsAccepted(generation);
    lifecycle.drainCommands();

    lifecycle.advanceTo(10_000);

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'online', generation });
    expect(lifecycle.drainCommands()).not.toContainEqual(expect.objectContaining({ type: 'reconnect' }));
  });

  it('does not reconnect or navigate into a room when the participant page reloads', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    const generation = lifecycle.scanQr('room-1');
    lifecycle.transportOpened(generation);
    lifecycle.bootstrapReceived(generation);
    lifecycle.playersConfirmed(generation);
    lifecycle.claimsAccepted(generation);
    lifecycle.drainCommands();

    lifecycle.pageReloaded();

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'idle', roomId: null, generation: null });
    expect(lifecycle.drainCommands()).toEqual([{ type: 'disconnect', generation }]);
  });

  it('connects only after the user explicitly opens the persisted active session', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    lifecycle.pageReloaded();
    expect(lifecycle.drainCommands()).toEqual([]);

    const generation = lifecycle.resumeSession('room-1');

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'connecting', roomId: 'room-1', generation });
    expect(lifecycle.drainCommands()).toContainEqual({ type: 'connect', roomId: 'room-1', generation });
  });

  it('lets a new QR scan replace every stale or currently-online generation', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    const oldGeneration = lifecycle.scanQr('room-1');
    lifecycle.transportOpened(oldGeneration);
    lifecycle.bootstrapReceived(oldGeneration);
    lifecycle.playersConfirmed(oldGeneration);
    lifecycle.claimsAccepted(oldGeneration);
    lifecycle.drainCommands();

    const newGeneration = lifecycle.scanQr('room-1');

    expect(newGeneration).not.toBe(oldGeneration);
    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'connecting', generation: newGeneration });
    expect(lifecycle.drainCommands()).toEqual([
      { type: 'disconnect', generation: oldGeneration },
      { type: 'connect', roomId: 'room-1', generation: newGeneration },
    ]);
  });

  it('ignores late callbacks from the connection replaced by a newer QR scan', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    const oldGeneration = lifecycle.scanQr('room-1');
    const newGeneration = lifecycle.scanQr('room-1');
    lifecycle.drainCommands();

    lifecycle.bootstrapReceived(oldGeneration);
    lifecycle.connectionClosed(oldGeneration);

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'connecting', generation: newGeneration });
    expect(lifecycle.drainCommands()).toEqual([]);
  });

  it('disconnects from every active phase when the underlying session is deleted', () => {
    for (const phase of ['connecting', 'selecting-players', 'online', 'reconnecting'] as const) {
      const lifecycle = createMultiplayerConnectionLifecycle();
      const generation = lifecycle.scanQr(`room-${phase}`);
      if (phase !== 'connecting') lifecycle.bootstrapReceived(generation);
      if (phase === 'online' || phase === 'reconnecting') {
        lifecycle.playersConfirmed(generation);
        lifecycle.claimsAccepted(generation);
      }
      if (phase === 'reconnecting') lifecycle.connectionClosed(generation);
      lifecycle.drainCommands();

      lifecycle.sessionDeleted(`room-${phase}`);

      expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'idle', roomId: null, generation: null });
      expect(lifecycle.drainCommands()).toEqual([
        { type: 'disconnect', generation },
        { type: 'navigate-dashboard' },
      ]);
    }
  });

  it('disconnects a superseded tab and sends it back to the dashboard', () => {
    const lifecycle = createMultiplayerConnectionLifecycle();
    const generation = lifecycle.scanQr('room-1');
    lifecycle.drainCommands();

    lifecycle.tabSuperseded(generation);

    expect(lifecycle.getSnapshot()).toMatchObject({ phase: 'idle', roomId: null, generation: null });
    expect(lifecycle.drainCommands()).toEqual([
      { type: 'disconnect', generation },
      { type: 'navigate-dashboard' },
      { type: 'show-takeover-notice' },
    ]);
  });
});

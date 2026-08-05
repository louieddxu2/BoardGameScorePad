import { describe, expect, it, vi } from 'vitest';
import { GameSession } from '../../types';
import { createMultiplayerSessionManager, isMultiplayerRoomReusableForQrScan } from './multiplayerSessionManager';
import { multiplayerLocalStore } from './multiplayerLocalStore';

const session: GameSession = {
  id: 'session-1', templateId: 'template-1', name: 'Test', startTime: 1, status: 'active', players: [],
};

const createRuntime = (role: 'host' | 'player') => ({ role, stop: vi.fn(), start: vi.fn(), controller: {}, session: {} } as any);

describe('multiplayer session manager', () => {
  it('keeps a room alive when its score-sheet view detaches', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('host');
    manager.register('room-1', runtime);
    manager.attachView('room-1');
    manager.detachView('room-1');
    expect(runtime.stop).not.toHaveBeenCalled();
    expect(manager.get('room-1')).toMatchObject({ status: 'connected', isViewAttached: false, runtime });
  });

  it('stops a room only when explicitly closed', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    manager.register('room-1', runtime);
    manager.closeRoom('room-1');
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(manager.get('room-1')).toBeNull();
  });

  it('tracks background room cleanup before the same room can be reused', async () => {
    let resolveCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => { resolveCleanup = resolve; });
    const purgeSpy = vi.spyOn(multiplayerLocalStore, 'purgeRoomData').mockReturnValue(cleanup);
    try {
      const manager = createMultiplayerSessionManager();
      const runtime = createRuntime('player');
      manager.register('room-1', runtime);

      await manager.closeRoom('room-1', { deleteLocalRoom: true, awaitLocalCleanup: false });
      let finished = false;
      const waiting = manager.waitForRoomCleanup('room-1').then(() => { finished = true; });

      await Promise.resolve();
      expect(finished).toBe(false);
      resolveCleanup();
      await waiting;
      expect(finished).toBe(true);
      expect(purgeSpy).toHaveBeenCalledWith('room-1');
    } finally {
      purgeSpy.mockRestore();
    }
  });

  it('marks a player with no connections as reconnecting while keeping the runtime alive', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    manager.register('room-1', runtime, 'connected');
    manager.setConnectionCount('room-1', 0);
    expect(manager.get('room-1')?.status).toBe('reconnecting');
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it('reuses a player room for QR scans while its runtime can reconnect', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    runtime.session = { session };
    manager.register('room-1', runtime, 'connected');
    expect(isMultiplayerRoomReusableForQrScan(manager.get('room-1'))).toBe(true);

    manager.setConnectionCount('room-1', 1);
    expect(isMultiplayerRoomReusableForQrScan(manager.get('room-1'))).toBe(true);
  });

  it('holds an ownership return until the local view consumes it', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    manager.register('room-1', runtime);
    manager.returnOwnership('room-1', session);
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(manager.get('room-1')).toMatchObject({ status: 'ownership-returned', runtime: null });
    expect(manager.peekReturnedSession('room-1')).toEqual(session);
    expect(manager.get('room-1')).not.toBeNull();
    expect(manager.takeReturnedSession('room-1')).toEqual(session);
    expect(manager.get('room-1')).toBeNull();
  });

  it('provides runtime callbacks that publish canonical sessions and return ownership', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    manager.register('room-1', runtime);
    const callbacks = manager.createRuntimeCallbacks('room-1');
    callbacks.onSessionSnapshot({ ...session, name: 'Canonical' });
    expect(manager.get('room-1')?.session?.name).toBe('Canonical');
    callbacks.onOwnershipReturned(session);
    expect(manager.get('room-1')?.status).toBe('ownership-returned');
  });

  it('publishes participant claim counts separately from the score snapshot', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('host');
    manager.register('room-1', runtime);
    manager.setParticipantClaims('room-1', { p1: 2, p2: 1 });
    expect(manager.get('room-1')?.participantClaims).toEqual({ p1: 2, p2: 1 });
  });

  it('tracks unpublished board updates for a host room', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('host');
    manager.register('room-1', runtime);
    manager.setUnpublishedBoardUpdate('room-1', true);
    expect(manager.get('room-1')?.hasUnpublishedBoardUpdate).toBe(true);
    manager.setUnpublishedBoardUpdate('room-1', false);
    expect(manager.get('room-1')?.hasUnpublishedBoardUpdate).toBe(false);
  });

  it('stops existing runtime during re-registration if runtime changes', () => {
    const manager = createMultiplayerSessionManager();
    const runtime1 = createRuntime('host');
    const runtime2 = createRuntime('host');
    manager.register('room-1', runtime1);
    manager.register('room-1', runtime2);
    expect(runtime1.stop).toHaveBeenCalledOnce();
    expect(manager.get('room-1')?.runtime).toBe(runtime2);
  });
});

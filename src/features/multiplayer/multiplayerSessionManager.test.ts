import { describe, expect, it, vi } from 'vitest';
import { GameSession } from '../../types';
import { createMultiplayerSessionManager } from './multiplayerSessionManager';

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

  it('holds an ownership return until the local view consumes it', () => {
    const manager = createMultiplayerSessionManager(); const runtime = createRuntime('player');
    manager.register('room-1', runtime);
    manager.returnOwnership('room-1', session);
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(manager.get('room-1')).toMatchObject({ status: 'ownership-returned', runtime: null });
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
});

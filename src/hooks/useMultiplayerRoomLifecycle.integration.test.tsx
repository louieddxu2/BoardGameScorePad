import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiplayerRoomLifecycle } from './useMultiplayerRoomLifecycle';
import { createMultiplayerPlayerRoomRuntime, restoreMultiplayerPlayerRoomRuntime } from '../features/multiplayer/multiplayerRoomRuntime';

const mocks = vi.hoisted(() => {
  const transport = {
    joinRoom: vi.fn(),
    stop: vi.fn(),
    setConnectionChangeHandler: vi.fn(),
  };
  const runtime = {
    role: 'player',
    session: { template: { id: 'template-1' }, session: { id: 'session-1', status: 'active' } },
    stop: vi.fn(),
    start: vi.fn(),
    leaveRoom: vi.fn(),
    restoreParticipantBinding: vi.fn(async () => true),
  };
  const state: any = {
    adapterOptions: null as any,
    managedRoom: null as any,
    transport,
    runtime,
    isCurrentClaim: true,
    supersedeListener: null,
    roomRecord: null,
  };
  state.closeRoom = vi.fn(async () => {
    state.managedRoom?.runtime?.stop?.();
    state.managedRoom = null;
  });
  state.register = vi.fn((_roomId: string, nextRuntime: any) => {
    state.managedRoom = { role: 'player', runtime: nextRuntime, session: nextRuntime.session.session };
  });
  state.claim = vi.fn((roomId: string) => ({ ownerId: 'tab-1', generation: `claim-${state.claim.mock.calls.length}`, roomId, claimedAt: 1 }));
  return state;
});

vi.mock('peerjs', () => ({ default: class Peer {} }));
vi.mock('../components/modals/InAppBrowserGuide', () => ({ isInAppBrowser: () => false }));
vi.mock('../features/multiplayer/multiplayerLocalStore', () => ({
  createLocalScoreStateSyncAdapter: vi.fn((_roomId, _role, options) => {
    mocks.adapterOptions = options;
    return {};
  }),
  multiplayerLocalStore: { getRoomBySessionId: vi.fn(async () => mocks.roomRecord) },
}));
vi.mock('../features/multiplayer/multiplayerDeliveryStore', () => ({
  getOrCreateMultiplayerDeviceId: vi.fn(async () => 'device-1'),
  multiplayerDeliveryStore: {},
}));
vi.mock('../features/multiplayer/multiplayerParticipantBinding', () => ({
  multiplayerParticipantBindingStore: { get: vi.fn(async () => null) },
  participantBindingKey: vi.fn(() => 'binding-1'),
  saveParticipantBinding: vi.fn(async () => undefined),
}));
vi.mock('../features/multiplayer/multiplayerP2PRuntimeTransport', () => ({
  createMultiplayerP2PRuntimeTransport: vi.fn(() => mocks.transport),
}));
vi.mock('../features/multiplayer/multiplayerRoomRuntime', () => ({
  createMultiplayerHostRoomRuntime: vi.fn(),
  createMultiplayerPlayerRoomRuntime: vi.fn(async () => mocks.runtime),
  restoreMultiplayerHostRoomRuntime: vi.fn(),
  restoreMultiplayerPlayerRoomRuntime: vi.fn(),
}));
vi.mock('../features/multiplayer/multiplayerSessionManager', () => ({
  multiplayerSessionManager: {
    get: vi.fn(() => mocks.managedRoom),
    waitForRoomCleanup: vi.fn(async () => undefined),
    supersedeRoomCleanup: vi.fn(),
    closeRoom: mocks.closeRoom,
    register: mocks.register,
    createRuntimeCallbacks: vi.fn(() => ({ onSessionSnapshot: vi.fn(), onOwnershipReturned: vi.fn() })),
    setConnectionCount: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    takeReturnedSession: vi.fn(() => null),
  },
}));
vi.mock('../features/multiplayer/multiplayerPersistence', () => ({
  releaseMultiplayerRoomOwnership: vi.fn(),
  retainMultiplayerCompletionRelay: vi.fn(),
}));
vi.mock('../features/multiplayer/multiplayerTabCoordinator', () => ({
  createMultiplayerTabCoordinator: vi.fn(() => ({
    claim: mocks.claim,
    isCurrent: vi.fn(() => mocks.isCurrentClaim),
    release: vi.fn(),
    subscribe: vi.fn((listener) => {
      mocks.supersedeListener = listener;
      return () => { mocks.supersedeListener = null; };
    }),
  })),
}));
vi.mock('../features/multiplayer/sessionDeletionEvents', () => ({ subscribeToSessionDeletion: vi.fn(() => () => undefined) }));
vi.mock('../db', () => ({ db: { sessions: { get: vi.fn(async () => undefined) } } }));

const appData = {
  isDbReady: true,
  activeSessions: [],
  resumeSessionById: vi.fn(async () => true),
  currentSession: null,
  activeTemplate: null,
} as any;
const enterActiveSession = vi.fn();
const returnToDashboard = vi.fn();
const showToast = vi.fn();
const tApp = ((key: string) => key) as any;

const renderLifecycle = () => renderHook(() => useMultiplayerRoomLifecycle({
  appData,
  enterActiveSession,
  returnToDashboard,
  showToast,
  tApp,
}));

describe('useMultiplayerRoomLifecycle QR integration', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.adapterOptions = null;
    mocks.managedRoom = null;
    mocks.isCurrentClaim = true;
    mocks.supersedeListener = null;
    mocks.roomRecord = null;
    mocks.transport.joinRoom.mockReset();
    mocks.transport.stop.mockReset();
    mocks.runtime.stop.mockReset();
    mocks.runtime.start.mockReset();
    mocks.runtime.leaveRoom.mockReset();
    vi.mocked(createMultiplayerPlayerRoomRuntime).mockClear();
    mocks.closeRoom.mockClear();
    mocks.register.mockClear();
    mocks.claim.mockClear();
    enterActiveSession.mockClear();
    returnToDashboard.mockClear();
    showToast.mockClear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    appData.isDbReady = true;
    appData.activeSessions = [];
  });

  it('does not replay a stored join intent after a page reload without a QR URL', async () => {
    sessionStorage.setItem('boardgame-scorepad-pending-room-join', JSON.stringify({ roomId: 'room-1', createdAt: Date.now() }));

    renderLifecycle();

    await waitFor(() => expect(sessionStorage.getItem('boardgame-scorepad-pending-room-join')).toBeNull());
    expect(mocks.transport.joinRoom).not.toHaveBeenCalled();
  });

  it('shows the player picker when bootstrap arrives before the three-second deadline', async () => {
    window.history.replaceState({}, '', '/?room=room-1');
    const { result } = renderLifecycle();
    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));

    await act(async () => {
      await mocks.adapterOptions.onRemoteBootstrap(
        { package: { revision: 1 } },
        { templateForSession: { id: 'template-1' }, session: { id: 'session-1', status: 'active' } },
      );
    });

    expect(mocks.register).toHaveBeenCalled();
    expect(mocks.register).toHaveBeenCalledWith('room-1', mocks.runtime, 'connected');
    await waitFor(() => expect(result.current.pendingMultiplayerJoin?.roomId).toBe('room-1'));
    expect(mocks.transport.stop).not.toHaveBeenCalled();
  });

  it('creates and registers only one player runtime when bootstrap delivery overlaps', async () => {
    window.history.replaceState({}, '', '/?room=room-1');
    renderLifecycle();
    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));

    const bootstrap = { package: { revision: 1 } };
    const persisted = { templateForSession: { id: 'template-1' }, session: { id: 'session-1', status: 'active' } };
    await act(async () => {
      await Promise.all([
        mocks.adapterOptions.onRemoteBootstrap(bootstrap, persisted),
        mocks.adapterOptions.onRemoteBootstrap(bootstrap, persisted),
      ]);
    });

    expect(createMultiplayerPlayerRoomRuntime).toHaveBeenCalledTimes(1);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.transport.stop).not.toHaveBeenCalled();
  });

  it('replaces an existing room runtime when the same QR code is scanned again', async () => {
    mocks.managedRoom = { role: 'player', runtime: mocks.runtime, session: mocks.runtime.session.session };
    window.history.replaceState({}, '', '/?room=room-1');

    renderLifecycle();

    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));
    expect(mocks.closeRoom).toHaveBeenCalledWith('room-1');
    expect(mocks.runtime.stop).toHaveBeenCalledTimes(1);
  });

  it('stops an in-flight join and returns the superseded page to the dashboard', async () => {
    window.history.replaceState({}, '', '/?room=room-1');
    renderLifecycle();
    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));

    mocks.isCurrentClaim = false;
    act(() => mocks.supersedeListener({ ownerId: 'tab-2', generation: 'new', roomId: 'room-1', claimedAt: 2 }));

    expect(mocks.transport.stop).toHaveBeenCalled();
    expect(mocks.closeRoom).toHaveBeenCalledWith('room-1');
    expect(returnToDashboard).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ message: 'app_toast_multiplayer_moved_to_new_tab', type: 'info' });
  });

  it('starts a fresh QR join without waiting for stale destructive cleanup', async () => {
    let finishCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => { finishCleanup = resolve; });
    const manager = await import('../features/multiplayer/multiplayerSessionManager');
    vi.mocked(manager.multiplayerSessionManager.waitForRoomCleanup).mockReturnValueOnce(cleanup);
    window.history.replaceState({}, '', '/?room=room-1');
    renderHook(() => useMultiplayerRoomLifecycle({
      appData,
      enterActiveSession,
      returnToDashboard,
      showToast,
      tApp,
    }));

    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));
    expect(manager.multiplayerSessionManager.supersedeRoomCleanup).toHaveBeenCalledWith('room-1');
    expect(showToast).not.toHaveBeenCalledWith({ message: 'app_toast_multiplayer_join_timeout', type: 'warning' });
    await act(async () => { finishCleanup(); await cleanup; await Promise.resolve(); });
    expect(mocks.transport.joinRoom).toHaveBeenCalledTimes(1);
  });

  it('abandons the old active participant runtime when one scan targets a different room', async () => {
    appData.isDbReady = false;
    mocks.roomRecord = {
      roomId: 'room-old', sessionId: 'session-1', templateId: 'template-1', hostDeviceId: 'host-1',
      role: 'player', status: 'active', revision: 2, createdAt: 1, updatedAt: 2,
    };
    mocks.managedRoom = { role: 'player', runtime: mocks.runtime, session: mocks.runtime.session.session };
    const { result, rerender } = renderLifecycle();
    await act(async () => { await result.current.tryRestoreMultiplayerRoom('session-1'); });
    expect(result.current.activeMultiplayerRoom?.roomId).toBe('room-old');

    mocks.transport.joinRoom.mockClear();
    window.history.replaceState({}, '', '/?room=room-new');
    appData.isDbReady = true;
    rerender();

    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-new'));
    expect(mocks.runtime.leaveRoom).toHaveBeenCalled();
    expect(mocks.closeRoom).toHaveBeenCalledWith('room-old');
    expect(result.current.activeMultiplayerRoom).toBeNull();
  });

  it('returns to a usable state when transport startup throws', async () => {
    mocks.transport.joinRoom.mockImplementationOnce(() => { throw new Error('peer_start_failed'); });
    window.history.replaceState({}, '', '/?room=room-1');
    const { result } = renderLifecycle();

    await waitFor(() => expect(showToast).toHaveBeenCalledWith({
      message: 'app_toast_multiplayer_join_timeout',
      type: 'warning',
    }));
    expect(result.current.isJoiningMultiplayer).toBe(false);
    expect(result.current.pendingMultiplayerJoin).toBeNull();
    expect(mocks.transport.stop).toHaveBeenCalled();
  });

  it('treats room completion before bootstrap as a final result instead of hanging', async () => {
    window.history.replaceState({}, '', '/?room=room-1');
    const { result } = renderLifecycle();
    await waitFor(() => expect(mocks.transport.joinRoom).toHaveBeenCalledWith('room-1'));

    await act(async () => {
      await mocks.adapterOptions.onRemoteCompletion({ type: 'session:completed', roomId: 'room-1' });
    });

    expect(showToast).toHaveBeenCalledWith({ message: 'app_toast_multiplayer_room_ended', type: 'info' });
    expect(result.current.isJoiningMultiplayer).toBe(false);
    expect(result.current.pendingMultiplayerJoin).toBeNull();
    expect(mocks.transport.stop).toHaveBeenCalled();
  });

  it('ignores a bootstrap that arrives after the QR deadline has already recovered the UI', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?room=room-1');
    const { result } = renderLifecycle();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3_001); });

    await act(async () => {
      await mocks.adapterOptions.onRemoteBootstrap(
        { package: { revision: 1 } },
        { templateForSession: { id: 'template-1' }, session: { id: 'session-1', status: 'active' } },
      );
    });

    expect(result.current.pendingMultiplayerJoin).toBeNull();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ message: 'app_toast_multiplayer_join_timeout', type: 'warning' });
  });

  it('does not restore a completed host relay as an active host room', async () => {
    mocks.roomRecord = {
      roomId: 'room-1', sessionId: 'session-1', templateId: 'template-1', hostDeviceId: 'host-1',
      role: 'host', status: 'completed', revision: 2, createdAt: 1, updatedAt: 2,
    };
    mocks.managedRoom = { role: 'host', runtime: { role: 'host' }, session: { id: 'session-1', status: 'completed' } };
    appData.activeSessions = [{ id: 'session-1', status: 'active' }];
    const { result } = renderLifecycle();

    await act(async () => { await result.current.tryRestoreMultiplayerRoom('session-1'); });

    expect(result.current.activeMultiplayerRoom).toBeNull();
  });

  it('still restores an active host room', async () => {
    mocks.roomRecord = {
      roomId: 'room-1', sessionId: 'session-1', templateId: 'template-1', hostDeviceId: 'host-1',
      role: 'host', status: 'active', revision: 2, createdAt: 1, updatedAt: 2,
    };
    mocks.managedRoom = { role: 'host', runtime: { role: 'host' }, session: { id: 'session-1', status: 'active' } };
    appData.activeSessions = [{ id: 'session-1', status: 'active' }];
    const { result } = renderLifecycle();

    await act(async () => { await result.current.tryRestoreMultiplayerRoom('session-1'); });

    expect(result.current.activeMultiplayerRoom).toEqual({ roomId: 'room-1', role: 'host' });
  });

  it('does not resurrect a participant room when another tab supersedes an in-flight restore', async () => {
    mocks.roomRecord = {
      roomId: 'room-1', sessionId: 'session-1', templateId: 'template-1', hostDeviceId: 'host-1',
      role: 'player', status: 'active', revision: 2, createdAt: 1, updatedAt: 2,
    };
    let finishRestore!: (runtime: any) => void;
    vi.mocked(restoreMultiplayerPlayerRoomRuntime).mockImplementationOnce(() => new Promise((resolve) => {
      finishRestore = resolve;
    }));
    const { result } = renderLifecycle();

    let restoreResult!: Promise<boolean>;
    act(() => {
      restoreResult = result.current.tryRestoreMultiplayerRoom('session-1');
    });
    await waitFor(() => expect(mocks.claim).toHaveBeenCalledWith('room-1'));

    mocks.isCurrentClaim = false;
    act(() => mocks.supersedeListener({ ownerId: 'tab-2', generation: 'new', roomId: 'room-1', claimedAt: 2 }));
    await act(async () => {
      finishRestore(mocks.runtime);
      await restoreResult;
    });

    expect(result.current.activeMultiplayerRoom).toBeNull();
    expect(mocks.runtime.start).not.toHaveBeenCalled();
    expect(await restoreResult).toBe(false);
  });
});

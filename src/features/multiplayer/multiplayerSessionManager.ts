import { GameSession } from '../../types';
import { MultiplayerHostRoomRuntime, MultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { ParticipantClaimCounts } from './multiplayerRoomController';

export type MultiplayerConnectionStatus =
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'disconnected'
  | 'ownership-returned';

export type ManagedMultiplayerRuntime = MultiplayerHostRoomRuntime | MultiplayerPlayerRoomRuntime;

export interface MultiplayerRoomState {
  roomId: string;
  role: 'host' | 'player';
  status: MultiplayerConnectionStatus;
  isViewAttached: boolean;
  runtime: ManagedMultiplayerRuntime | null;
  session?: GameSession;
  returnedSession?: GameSession;
  connectionCount: number;
  participantClaims: ParticipantClaimCounts;
  hasUnpublishedBoardUpdate: boolean;
}

export interface MultiplayerSessionManager {
  register(roomId: string, runtime: ManagedMultiplayerRuntime, status?: MultiplayerConnectionStatus): MultiplayerRoomState;
  get(roomId: string): MultiplayerRoomState | null;
  attachView(roomId: string): MultiplayerRoomState | null;
  detachView(roomId: string): void;
  setConnectionStatus(roomId: string, status: Exclude<MultiplayerConnectionStatus, 'ownership-returned'>): void;
  setConnectionCount(roomId: string, connectionCount: number): void;
  setParticipantClaims(roomId: string, claims: ParticipantClaimCounts): void;
  setUnpublishedBoardUpdate(roomId: string, hasUnpublishedBoardUpdate: boolean): void;
  publishSession(roomId: string, session: GameSession): void;
  createRuntimeCallbacks(roomId: string): {
    onSessionSnapshot: (session: GameSession) => void;
    onOwnershipReturned: (session: GameSession) => void;
  };
  returnOwnership(roomId: string, session: GameSession): void;
  peekReturnedSession(roomId: string): GameSession | null;
  takeReturnedSession(roomId: string): GameSession | null;
  closeRoom(roomId: string): void;
  subscribe(listener: () => void): () => void;
}

const snapshot = (state: MultiplayerRoomState): MultiplayerRoomState => ({
  ...state,
  returnedSession: state.returnedSession ? JSON.parse(JSON.stringify(state.returnedSession)) as GameSession : undefined,
  session: state.session ? JSON.parse(JSON.stringify(state.session)) as GameSession : undefined,
});

/**
 * Keeps P2P rooms alive independently of a mounted score-sheet view. A UI can
 * attach and detach freely; only an explicit close stops the transport.
 */
export const createMultiplayerSessionManager = (): MultiplayerSessionManager => {
  const rooms = new Map<string, MultiplayerRoomState>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const get = (roomId: string) => {
    const state = rooms.get(roomId);
    return state ? snapshot(state) : null;
  };

  return {
    register(roomId, runtime, status = 'connected') {
      const runtimeSession = runtime.role === 'host' ? runtime.session.session : runtime.session.session;
      const connectionCount = (runtime as Partial<ManagedMultiplayerRuntime>).getConnectionCount?.() ?? 0;
      const participantClaims = (runtime as Partial<ManagedMultiplayerRuntime>).getParticipantClaims?.() ?? {};
      const state: MultiplayerRoomState = { roomId, role: runtime.role, status, isViewAttached: false, runtime, session: runtimeSession, connectionCount, participantClaims, hasUnpublishedBoardUpdate: false };
      rooms.set(roomId, state);
      notify();
      return snapshot(state);
    },
    get,
    attachView(roomId) {
      const state = rooms.get(roomId);
      if (!state) return null;
      state.isViewAttached = true;
      notify();
      return snapshot(state);
    },
    detachView(roomId) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime) return;
      state.isViewAttached = false;
      notify();
    },
    setConnectionStatus(roomId, status) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime) return;
      state.status = status;
      notify();
    },
    setConnectionCount(roomId, connectionCount) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime) return;
      state.connectionCount = Math.max(0, connectionCount);
      state.status = state.connectionCount > 0 ? 'connected' : 'disconnected';
      notify();
    },
    setParticipantClaims(roomId, claims) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime) return;
      state.participantClaims = { ...claims };
      notify();
    },
    setUnpublishedBoardUpdate(roomId, hasUnpublishedBoardUpdate) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime || state.role !== 'host') return;
      state.hasUnpublishedBoardUpdate = hasUnpublishedBoardUpdate;
      notify();
    },
    publishSession(roomId, session) {
      const state = rooms.get(roomId);
      if (!state || !state.runtime) return;
      state.session = JSON.parse(JSON.stringify(session)) as GameSession;
      notify();
    },
    createRuntimeCallbacks(roomId) {
      return {
        onSessionSnapshot: (session) => { this.publishSession(roomId, session); },
        onOwnershipReturned: (session) => { this.returnOwnership(roomId, session); },
      };
    },
    returnOwnership(roomId, session) {
      const state = rooms.get(roomId);
      if (!state) return;
      state.runtime?.stop();
      state.runtime = null;
      state.status = 'ownership-returned';
      state.returnedSession = JSON.parse(JSON.stringify(session)) as GameSession;
      state.session = undefined;
      notify();
    },
    peekReturnedSession(roomId) {
      const state = rooms.get(roomId);
      if (!state?.returnedSession) return null;
      return JSON.parse(JSON.stringify(state.returnedSession)) as GameSession;
    },
    takeReturnedSession(roomId) {
      const state = rooms.get(roomId);
      if (!state?.returnedSession) return null;
      const session = JSON.parse(JSON.stringify(state.returnedSession)) as GameSession;
      rooms.delete(roomId);
      notify();
      return session;
    },
    closeRoom(roomId) {
      const state = rooms.get(roomId);
      if (!state) return;
      state.runtime?.stop();
      rooms.delete(roomId);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};

/** Application-level owner. It is intentionally outside SessionView. */
export const multiplayerSessionManager = createMultiplayerSessionManager();

import { generateId } from '../../utils/idGenerator';

const MULTIPLAYER_ACTIVE_TAB_KEY = 'boardgame-scorepad-active-multiplayer-tab';
const MULTIPLAYER_TAB_CHANNEL = 'boardgame-scorepad-multiplayer-tab';

export type MultiplayerTabClaim = {
  ownerId: string;
  generation: string;
  roomId: string;
  claimedAt: number;
};

type MultiplayerTabMessage = {
  type: 'participant-takeover';
  claim: MultiplayerTabClaim;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type ChannelLike = {
  postMessage(message: MultiplayerTabMessage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<MultiplayerTabMessage>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<MultiplayerTabMessage>) => void): void;
  close(): void;
};

type LifecycleTarget = {
  addEventListener(type: 'storage' | 'focus' | 'pageshow' | 'visibilitychange', listener: EventListener): void;
  removeEventListener(type: 'storage' | 'focus' | 'pageshow' | 'visibilitychange', listener: EventListener): void;
};

const parseClaim = (raw: string | null): MultiplayerTabClaim | null => {
  if (!raw) return null;
  try {
    const claim = JSON.parse(raw) as Partial<MultiplayerTabClaim>;
    if (
      typeof claim.ownerId !== 'string' ||
      typeof claim.generation !== 'string' ||
      typeof claim.roomId !== 'string' ||
      typeof claim.claimedAt !== 'number'
    ) return null;
    return claim as MultiplayerTabClaim;
  } catch {
    return null;
  }
};

export const createMultiplayerTabCoordinator = (options?: {
  storage?: StorageLike | null;
  channel?: ChannelLike | null;
  lifecycleTarget?: LifecycleTarget | null;
  now?: () => number;
  ownerId?: string;
}) => {
  const storage = options && 'storage' in options ? options.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const lifecycleTarget = options && 'lifecycleTarget' in options ? options.lifecycleTarget : (typeof window !== 'undefined' ? window : null);
  const channel = options && 'channel' in options ? options.channel : (typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(MULTIPLAYER_TAB_CHANNEL) : null);
  const now = options?.now ?? Date.now;
  const ownerId = options?.ownerId ?? generateId();
  const listeners = new Set<(claim: MultiplayerTabClaim) => void>();
  let currentClaim: MultiplayerTabClaim | null = null;

  const readActiveClaim = () => parseClaim(storage?.getItem(MULTIPLAYER_ACTIVE_TAB_KEY) ?? null);
  const ownsClaim = (claim: MultiplayerTabClaim | null) => {
    if (!claim || claim.ownerId !== ownerId) return false;
    const active = readActiveClaim();
    return active?.ownerId === claim.ownerId && active.generation === claim.generation;
  };
  const notifyIfSuperseded = () => {
    if (!currentClaim || ownsClaim(currentClaim)) return;
    const active = readActiveClaim();
    if (!active || active.ownerId === ownerId) return;
    for (const listener of listeners) listener(active);
  };
  const handleMessage = (event: MessageEvent<MultiplayerTabMessage>) => {
    if (event.data?.type !== 'participant-takeover' || event.data.claim.ownerId === ownerId) return;
    notifyIfSuperseded();
  };
  const handleLifecycleEvent: EventListener = () => notifyIfSuperseded();

  channel?.addEventListener('message', handleMessage);
  lifecycleTarget?.addEventListener('storage', handleLifecycleEvent);
  lifecycleTarget?.addEventListener('focus', handleLifecycleEvent);
  lifecycleTarget?.addEventListener('pageshow', handleLifecycleEvent);
  lifecycleTarget?.addEventListener('visibilitychange', handleLifecycleEvent);

  return {
    get ownerId() { return ownerId; },
    claim(roomId: string): MultiplayerTabClaim {
      const claim = { ownerId, generation: generateId(), roomId, claimedAt: now() };
      currentClaim = claim;
      storage?.setItem(MULTIPLAYER_ACTIVE_TAB_KEY, JSON.stringify(claim));
      channel?.postMessage({ type: 'participant-takeover', claim });
      return claim;
    },
    isCurrent(claim: MultiplayerTabClaim | null) {
      return ownsClaim(claim);
    },
    release(claim: MultiplayerTabClaim | null) {
      if (ownsClaim(claim)) storage?.removeItem(MULTIPLAYER_ACTIVE_TAB_KEY);
      if (currentClaim?.generation === claim?.generation) currentClaim = null;
    },
    subscribe(listener: (claim: MultiplayerTabClaim) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    close() {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      lifecycleTarget?.removeEventListener('storage', handleLifecycleEvent);
      lifecycleTarget?.removeEventListener('focus', handleLifecycleEvent);
      lifecycleTarget?.removeEventListener('pageshow', handleLifecycleEvent);
      lifecycleTarget?.removeEventListener('visibilitychange', handleLifecycleEvent);
      listeners.clear();
    },
  };
};

export type MultiplayerTabCoordinator = ReturnType<typeof createMultiplayerTabCoordinator>;

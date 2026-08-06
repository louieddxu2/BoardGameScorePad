import { describe, expect, it, vi } from 'vitest';
import { createMultiplayerTabCoordinator } from './multiplayerTabCoordinator';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const createChannelPair = () => {
  const listeners = new Set<(event: MessageEvent<any>) => void>();
  const make = () => ({
    postMessage: (data: unknown) => { for (const listener of listeners) listener({ data } as MessageEvent); },
    addEventListener: (_type: 'message', listener: (event: MessageEvent<any>) => void) => { listeners.add(listener); },
    removeEventListener: (_type: 'message', listener: (event: MessageEvent<any>) => void) => { listeners.delete(listener); },
    close: vi.fn(),
  });
  return [make(), make()] as const;
};

describe('multiplayer tab coordinator', () => {
  it('makes the latest participant claim authoritative and supersedes the old tab', () => {
    const storage = createStorage();
    const [channelA, channelB] = createChannelPair();
    const first = createMultiplayerTabCoordinator({ storage, channel: channelA, lifecycleTarget: null, ownerId: 'tab-a', now: () => 1 });
    const second = createMultiplayerTabCoordinator({ storage, channel: channelB, lifecycleTarget: null, ownerId: 'tab-b', now: () => 2 });
    const onSuperseded = vi.fn();
    first.subscribe(onSuperseded);

    const firstClaim = first.claim('room-1');
    const secondClaim = second.claim('room-1');

    expect(first.isCurrent(firstClaim)).toBe(false);
    expect(second.isCurrent(secondClaim)).toBe(true);
    expect(onSuperseded).toHaveBeenCalledWith(secondClaim);
  });

  it('does not let an old tab release the latest tab claim', () => {
    const storage = createStorage();
    const [channelA, channelB] = createChannelPair();
    const first = createMultiplayerTabCoordinator({ storage, channel: channelA, lifecycleTarget: null, ownerId: 'tab-a' });
    const second = createMultiplayerTabCoordinator({ storage, channel: channelB, lifecycleTarget: null, ownerId: 'tab-b' });

    const firstClaim = first.claim('room-1');
    const secondClaim = second.claim('room-1');
    first.release(firstClaim);

    expect(second.isCurrent(secondClaim)).toBe(true);
  });

  it('detects takeover when a sleeping tab checks its persisted claim after resuming', () => {
    const storage = createStorage();
    const listeners = new Map<string, EventListener>();
    const lifecycleTarget = {
      addEventListener: (type: string, listener: EventListener) => { listeners.set(type, listener); },
      removeEventListener: (type: string) => { listeners.delete(type); },
    } as any;
    const first = createMultiplayerTabCoordinator({ storage, channel: null, lifecycleTarget, ownerId: 'tab-a' });
    const second = createMultiplayerTabCoordinator({ storage, channel: null, lifecycleTarget: null, ownerId: 'tab-b' });
    const onSuperseded = vi.fn();
    first.subscribe(onSuperseded);
    first.claim('room-1');
    const secondClaim = second.claim('room-1');

    listeners.get('pageshow')?.(new Event('pageshow'));

    expect(onSuperseded).toHaveBeenCalledWith(secondClaim);
  });

  it('keeps the current page usable when localStorage is unavailable', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('storage_blocked'); },
      setItem: () => { throw new Error('storage_blocked'); },
      removeItem: () => { throw new Error('storage_blocked'); },
    };
    const coordinator = createMultiplayerTabCoordinator({ storage: brokenStorage, channel: null, lifecycleTarget: null, ownerId: 'tab-a' });

    const claim = coordinator.claim('room-1');

    expect(coordinator.isCurrent(claim)).toBe(true);
    expect(() => coordinator.release(claim)).not.toThrow();
  });

  it('falls back to BroadcastChannel takeover when localStorage is unavailable', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('storage_blocked'); },
      setItem: () => { throw new Error('storage_blocked'); },
      removeItem: () => { throw new Error('storage_blocked'); },
    };
    const [channelA, channelB] = createChannelPair();
    const first = createMultiplayerTabCoordinator({ storage: brokenStorage, channel: channelA, lifecycleTarget: null, ownerId: 'tab-a', now: () => 1 });
    const second = createMultiplayerTabCoordinator({ storage: brokenStorage, channel: channelB, lifecycleTarget: null, ownerId: 'tab-b', now: () => 2 });
    const onSuperseded = vi.fn();
    first.subscribe(onSuperseded);
    first.claim('room-1');

    const secondClaim = second.claim('room-1');

    expect(onSuperseded).toHaveBeenCalledWith(secondClaim);
  });
});

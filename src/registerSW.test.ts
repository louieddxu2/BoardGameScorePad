import { describe, it, expect, vi } from 'vitest';
import { registerServiceWorker } from './registerSW';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('registerServiceWorker', () => {
  it('registers and updates service worker in PROD on window load', async () => {
    const update = vi.fn();
    const register = vi.fn(async () => ({ update }));
    const swAddEventListener = vi.fn();
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'load') cb();
    });

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj: { serviceWorker: { register, addEventListener: swAddEventListener } } as any,
      windowObj: { addEventListener } as any,
    });

    await flush();

    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(swAddEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('unregisters legacy workers in DEV', async () => {
    const unregister1 = vi.fn(async () => true);
    const unregister2 = vi.fn(async () => true);
    const getRegistrations = vi.fn(async () => [{ unregister: unregister1 }, { unregister: unregister2 }]);

    registerServiceWorker({
      env: { DEV: true, PROD: false },
      navigatorObj: { serviceWorker: { getRegistrations } } as any,
      windowObj: { addEventListener: vi.fn() } as any,
    });

    await flush();

    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregister1).toHaveBeenCalledTimes(1);
    expect(unregister2).toHaveBeenCalledTimes(1);
  });

  it('defers controller reload while a multiplayer room is active', async () => {
    const reload = vi.fn();
    const listeners = new Map<string, () => void>();
    const serviceWorkerListeners = new Map<string, () => void>();
    const register = vi.fn(async () => ({ update: vi.fn() }));
    const windowObj = {
      location: { search: '', reload },
      addEventListener: vi.fn((event: string, callback: () => void) => listeners.set(event, callback)),
    } as any;
    const navigatorObj = {
      serviceWorker: {
        register,
        addEventListener: vi.fn((event: string, callback: () => void) => serviceWorkerListeners.set(event, callback)),
      },
    } as any;

    windowObj.__boardGameScorePadMultiplayerActive = true;
    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj,
      windowObj,
    });

    serviceWorkerListeners.get('controllerchange')?.();
    expect(reload).not.toHaveBeenCalled();

    windowObj.__boardGameScorePadMultiplayerActive = false;
    listeners.get('boardgame-scorepad-multiplayer-state-change')?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not mistake an unrelated query parameter for a room join route', () => {
    const reload = vi.fn();
    const serviceWorkerListeners = new Map<string, () => void>();
    const register = vi.fn(async () => ({ update: vi.fn() }));
    const windowObj = {
      location: { search: '?roommate=notes', reload },
      addEventListener: vi.fn(),
    } as any;
    const navigatorObj = {
      serviceWorker: {
        register,
        addEventListener: vi.fn((event: string, callback: () => void) => serviceWorkerListeners.set(event, callback)),
      },
    } as any;

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj,
      windowObj,
    });

    serviceWorkerListeners.get('controllerchange')?.();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('allows controller reload while an explicit room join is pending', () => {
    const reload = vi.fn();
    const serviceWorkerListeners = new Map<string, () => void>();
    const register = vi.fn(async () => ({ update: vi.fn() }));
    const windowObj = {
      location: { search: '?room=room-1', reload },
      addEventListener: vi.fn(),
    } as any;
    const navigatorObj = {
      serviceWorker: {
        register,
        addEventListener: vi.fn((event: string, callback: () => void) => serviceWorkerListeners.set(event, callback)),
      },
    } as any;

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj,
      windowObj,
    });

    serviceWorkerListeners.get('controllerchange')?.();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('authorizes one update reload to resume the pending QR join before reloading', () => {
    const reload = vi.fn();
    const serviceWorkerListeners = new Map<string, () => void>();
    const values = new Map<string, string>([
      ['boardgame-scorepad-pending-room-join', JSON.stringify({ roomId: 'room-1', createdAt: Date.now() })],
    ]);
    const sessionStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    };
    const windowObj = {
      location: { search: '', reload },
      sessionStorage,
      addEventListener: vi.fn(),
      __boardGameScorePadMultiplayerActive: true,
      __boardGameScorePadMultiplayerJoinPending: true,
    } as any;
    const navigatorObj = {
      serviceWorker: {
        register: vi.fn(async () => ({ update: vi.fn() })),
        addEventListener: vi.fn((event: string, callback: () => void) => serviceWorkerListeners.set(event, callback)),
      },
    } as any;

    registerServiceWorker({ env: { DEV: false, PROD: true }, navigatorObj, windowObj });
    serviceWorkerListeners.get('controllerchange')?.();

    expect(JSON.parse(values.get('boardgame-scorepad-update-room-join') ?? '{}')).toMatchObject({ roomId: 'room-1' });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('still defers controller reload while joining is actively handshaking', () => {
    const reload = vi.fn();
    const serviceWorkerListeners = new Map<string, () => void>();
    const register = vi.fn(async () => ({ update: vi.fn() }));
    const windowObj = {
      location: { search: '?room=room-1', reload },
      addEventListener: vi.fn(),
      __boardGameScorePadMultiplayerActive: true,
      __boardGameScorePadMultiplayerJoinPending: false,
    } as any;
    const navigatorObj = {
      serviceWorker: {
        register,
        addEventListener: vi.fn((event: string, callback: () => void) => serviceWorkerListeners.set(event, callback)),
      },
    } as any;

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj,
      windowObj,
    });

    serviceWorkerListeners.get('controllerchange')?.();

    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing when serviceWorker is unavailable', async () => {
    const addEventListener = vi.fn();

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj: {} as any,
      windowObj: { addEventListener } as any,
    });

    await flush();

    expect(addEventListener).not.toHaveBeenCalled();
  });
});


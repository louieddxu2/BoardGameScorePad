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
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'load') cb();
    });

    registerServiceWorker({
      env: { DEV: false, PROD: true },
      navigatorObj: { serviceWorker: { register } } as any,
      windowObj: { addEventListener } as any,
    });

    await flush();

    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
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


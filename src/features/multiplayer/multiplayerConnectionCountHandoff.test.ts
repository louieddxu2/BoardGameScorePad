import { describe, expect, it, vi } from 'vitest';
import { createPostBootstrapConnectionCountHandler } from './multiplayerConnectionCountHandoff';

describe('post-bootstrap connection-count handoff', () => {
  it('suppresses only the initial zero replay after bootstrap proved the connection', () => {
    const onConnectionCount = vi.fn();
    const handle = createPostBootstrapConnectionCountHandler(onConnectionCount);

    handle(0);
    expect(onConnectionCount).not.toHaveBeenCalled();

    handle(1);
    handle(0);
    expect(onConnectionCount.mock.calls).toEqual([[1], [0]]);
  });

  it('forwards an initially open connection immediately', () => {
    const onConnectionCount = vi.fn();
    const handle = createPostBootstrapConnectionCountHandler(onConnectionCount);

    handle(1);

    expect(onConnectionCount).toHaveBeenCalledWith(1);
  });
});

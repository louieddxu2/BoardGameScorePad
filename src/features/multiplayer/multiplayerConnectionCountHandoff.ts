/**
 * A valid bootstrap can only arrive through an open data connection. When the
 * room runtime attaches afterwards, PeerJS may already be replacing that
 * connection and replay a transient count of zero. Do not reinterpret that
 * handoff snapshot as an immediate disconnect; all later counts remain
 * authoritative.
 */
export const createPostBootstrapConnectionCountHandler = (
  onConnectionCount: (connectionCount: number) => void,
) => {
  let isInitialReplay = true;
  return (connectionCount: number) => {
    if (isInitialReplay) {
      isInitialReplay = false;
      if (connectionCount === 0) return;
    }
    onConnectionCount(connectionCount);
  };
};

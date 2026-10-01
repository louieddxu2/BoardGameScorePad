interface ClickSource {
  detail?: number;
  pointerType?: string;
  pointerId?: number;
  sourceCapabilities?: { firesTouchEvents?: boolean } | null;
}

interface ClickContext {
  touchHandled?: boolean;
  nonTouchPointer?: boolean;
  programmaticDefaultAction?: boolean;
}

// A round owns all of its fingers until zero touches, independently of whether
// the app is currently changing its zoom. No timers or React subscriptions.
export const createTouchGestureGuard = () => {
  const state = { round: 0, sequence: 0, active: false, suppressClick: false };
  let touchCount = 0;
  let invalid = false;
  let handled = false;
  let hasRound = false;
  let nonTouchInput = false;
  let actionDepth = 0;
  const roundPointerIds = new Set<number>();
  const rejectedPointerIds = new Set<number>();
  const pendingPointerIds = new Set<number>();

  // Replacement fingers cannot grow a history indefinitely. Old ids are only
  // additional evidence; the round's sticky qualification is authoritative.
  const remember = (ids: Set<number>, id: number) => {
    ids.add(id);
    if (ids.size > 16) ids.delete(ids.values().next().value!);
  };

  const invalidate = () => {
    if (invalid) return;
    state.sequence++;
    invalid = true;
    state.suppressClick = true;
    for (const id of roundPointerIds) remember(rejectedPointerIds, id);
  };

  const start = (count: number) => {
    if (count === 0) return;
    if (touchCount === 0) {
      state.round++;
      hasRound = true;
      invalid = false;
      handled = false;
      roundPointerIds.clear();
      for (const id of pendingPointerIds) remember(roundPointerIds, id);
      pendingPointerIds.clear();
      // Do not erase the previous rejected click just because a new finger
      // landed. A new single-finger touchend can qualify immediately instead.
    }
    nonTouchInput = false;
    touchCount = count;
    if (count > 1) invalidate();
    state.active = invalid;
  };

  const move = (count: number) => {
    touchCount = count;
    if (count > 1) invalidate();
    state.active = invalid && count > 0;
  };

  const end = (count: number, cancelled = false) => {
    touchCount = count;
    if (cancelled || count > 1) invalidate();
    state.active = invalid && count > 0;
    if (count === 0 && !invalid) state.suppressClick = false;
  };

  const pointerDown = (event: ClickSource) => {
    if (event.pointerType === 'touch') {
      nonTouchInput = false;
      const id = event.pointerId;
      if (id === undefined) return;
      // Pointer ids may be reused in a truly new round.
      rejectedPointerIds.delete(id);
      if (touchCount === 0) remember(pendingPointerIds, id);
      else {
        remember(roundPointerIds, id);
        if (invalid) remember(rejectedPointerIds, id);
      }
    } else if ((event.pointerType === 'mouse' || event.pointerType === 'pen')
      && event.sourceCapabilities?.firesTouchEvents !== true) {
      nonTouchInput = true;
    }
  };

  const keyDown = (event: Pick<KeyboardEvent, 'key'>) => {
    if (event.key === 'Enter' || event.key === ' ') nonTouchInput = true;
  };

  const isAllowed = (round: number) => round === state.round && !invalid;

  const markHandled = (round: number) => {
    if (hasRound && isAllowed(round)) handled = true;
  };

  const shouldSuppressClick = (event: ClickSource, context: ClickContext = {}) => {
    const touchOrigin = event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents === true;
    if (touchOrigin) {
      return (event.pointerId !== undefined && rejectedPointerIds.has(event.pointerId))
        || touchCount > 0 || invalid || handled || Boolean(context.touchHandled);
    }
    // Modern non-pointing activation is explicit, unlike an unannotated
    // detail=0 MouseEvent, which could also be a touch compatibility click.
    if (event.pointerType === 'mouse' || event.pointerType === 'pen'
      || event.sourceCapabilities?.firesTouchEvents === false
      || (event.pointerType === '' && event.pointerId === -1)) return false;
    if (nonTouchInput || context.nonTouchPointer || context.programmaticDefaultAction || actionDepth > 0) return false;
    // Missing provenance must use the touch context, not the click count.
    // After a new native single-finger tap it belongs to that completed round;
    // late clicks with a pointer id still retain their previous disposition.
    return touchCount > 0 || state.suppressClick || handled || Boolean(context.touchHandled);
  };

  const runAction = <T,>(action: () => T): T => {
    const previousDepth = actionDepth;
    actionDepth++;
    try { return action(); } finally { actionDepth = previousDepth; }
  };

  const reset = () => {
    touchCount = 0;
    invalid = false;
    handled = false;
    hasRound = false;
    nonTouchInput = false;
    actionDepth = 0;
    state.active = false;
    state.suppressClick = false;
    roundPointerIds.clear();
    rejectedPointerIds.clear();
    pendingPointerIds.clear();
    // Keep generations monotonic so remounting cannot validate old handlers.
    state.round++;
  };

  return { getState: (): Readonly<typeof state> => state, start, move, end, pointerDown, keyDown,
    isAllowed, markHandled, shouldSuppressClick, runAction, reset };
};

export const touchGestureGuard = createTouchGestureGuard();

/** Shared by App's existing click capture and touch-action controls. */
export const suppressInvalidTouchClick = (event: MouseEvent): boolean => {
  // File choosers and download links are deliberately clicked by already
  // accepted UI actions, sometimes after an async export. Do not mistake these
  // specific untrusted default actions for a browser-generated touch click.
  const target = event.target;
  const programmaticDefaultAction = !event.isTrusted && (
    (target instanceof HTMLInputElement && target.type === 'file')
    || (target instanceof HTMLAnchorElement && target.hasAttribute('download'))
  );
  if (!touchGestureGuard.shouldSuppressClick(event, { programmaticDefaultAction })) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
};

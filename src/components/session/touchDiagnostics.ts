export const TOUCH_DIAGNOSTICS_FLAG = 'scorepad_touch_diagnostics';
const TOUCH_DIAGNOSTICS_ENTRIES = `${TOUCH_DIAGNOSTICS_FLAG}:entries`;
const MAX_ENTRIES = 200;
const CLICK_CORRELATION_WINDOW_MS = 900;

export interface TouchDiagnosticState {
  editingCell: string | null;
  editingPlayerId: string | null;
  isInputFocused: boolean;
  isToolboxOpen: boolean;
  isEditMode: boolean;
}

export type TouchDiagnosticKind =
  | 'pointerdown'
  | 'pointerup'
  | 'pointercancel'
  | 'touchstart'
  | 'touchend'
  | 'touchcancel'
  | 'click'
  | 'tap-without-click'
  | 'score-handler';

export interface TouchDiagnosticEntry {
  sequence: number;
  timestamp: string;
  kind: TouchDiagnosticKind;
  eventType: string;
  target: string;
  pointTarget: string;
  scoreCell: string | null;
  clientX: number | null;
  clientY: number | null;
  pointerType: string | null;
  touchCount: number | null;
  defaultPrevented: boolean;
  cancelBubble: boolean;
  correlation?: 'awaiting-click' | 'matched' | 'none';
  outcome?: string;
  state: TouchDiagnosticState;
}

export interface TouchDiagnosticsApi {
  isEnabled: () => boolean;
  enable: () => void;
  disable: () => void;
  clear: () => void;
  getEntries: () => TouchDiagnosticEntry[];
  exportJson: () => string;
}

declare global {
  interface Window {
    __scorePadTouchDiagnostics?: TouchDiagnosticsApi;
  }
}

const readStoredEntries = (): TouchDiagnosticEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(TOUCH_DIAGNOSTICS_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
};

let entries = readStoredEntries();
let sequence = entries.length > 0 ? entries[entries.length - 1].sequence : 0;

const persistEntries = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(TOUCH_DIAGNOSTICS_ENTRIES, JSON.stringify(entries));
  } catch {
    // Diagnostics must never interfere with the score pad when storage is unavailable.
  }
};

const readEnabledFlag = () => {
  if (typeof window === 'undefined') return false;

  try {
    const queryEnabled = new URLSearchParams(window.location.search).get('debugTouch') === '1';
    return queryEnabled || window.localStorage.getItem(TOUCH_DIAGNOSTICS_FLAG) === '1';
  } catch {
    return false;
  }
};

let diagnosticsActive = readEnabledFlag();

const isEnabled = () => diagnosticsActive;

const getScoreCell = (element: Element | null): string | null => {
  return element?.closest('[data-score-cell]')?.getAttribute('data-score-cell') || null;
};

const describeElement = (element: EventTarget | null): string => {
  if (!(element instanceof Element)) return element?.constructor?.name || 'unknown';

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const scoreCell = getScoreCell(element);
  const pointerEvents = typeof window !== 'undefined'
    ? window.getComputedStyle(element).pointerEvents
    : 'unknown';
  const zIndex = typeof window !== 'undefined'
    ? window.getComputedStyle(element).zIndex
    : 'unknown';

  return `${tag}${id} [score-cell=${scoreCell || '-'} pointer-events=${pointerEvents} z-index=${zIndex}]`;
};

const getPoint = (event: Event): { clientX: number | null; clientY: number | null; pointerType: string | null; touchCount: number | null } => {
  const touchEvent = event as TouchEvent;
  const touch = touchEvent.changedTouches?.[0] || touchEvent.touches?.[0];
  if (touch) {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerType: 'touch',
      touchCount: touchEvent.touches?.length ?? touchEvent.changedTouches?.length ?? null,
    };
  }

  const pointerEvent = event as PointerEvent;
  return {
    clientX: typeof pointerEvent.clientX === 'number' ? pointerEvent.clientX : null,
    clientY: typeof pointerEvent.clientY === 'number' ? pointerEvent.clientY : null,
    pointerType: typeof pointerEvent.pointerType === 'string' && pointerEvent.pointerType
      ? pointerEvent.pointerType
      : null,
    touchCount: null,
  };
};

const getPointTarget = (clientX: number | null, clientY: number | null): Element | null => {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
  if (clientX === null || clientY === null) return null;

  try {
    return document.elementFromPoint(clientX, clientY);
  } catch {
    return null;
  }
};

const appendEntry = (entry: Omit<TouchDiagnosticEntry, 'sequence' | 'timestamp'>) => {
  if (!isEnabled()) return;

  const nextEntry: TouchDiagnosticEntry = {
    ...entry,
    sequence: ++sequence,
    timestamp: new Date().toISOString(),
  };
  entries = [...entries, nextEntry].slice(-MAX_ENTRIES);
  persistEntries();
  console.info('[scorepad-touch]', nextEntry);
};

const createEventEntry = (
  kind: TouchDiagnosticKind,
  event: Event | null,
  state: TouchDiagnosticState,
  overrides: Partial<Pick<TouchDiagnosticEntry, 'correlation' | 'outcome' | 'target' | 'pointTarget' | 'scoreCell'>> = {},
): Omit<TouchDiagnosticEntry, 'sequence' | 'timestamp'> => {
  const point = event ? getPoint(event) : { clientX: null, clientY: null, pointerType: null, touchCount: null };
  const target = event?.target || null;
  const pointTarget = getPointTarget(point.clientX, point.clientY);

  return {
    kind,
    eventType: event?.type || kind,
    target: overrides.target || describeElement(target),
    pointTarget: overrides.pointTarget || describeElement(pointTarget),
    scoreCell: overrides.scoreCell ?? getScoreCell(pointTarget) ?? getScoreCell(target instanceof Element ? target : null),
    clientX: point.clientX,
    clientY: point.clientY,
    pointerType: point.pointerType,
    touchCount: point.touchCount,
    defaultPrevented: event?.defaultPrevented ?? false,
    cancelBubble: event?.cancelBubble ?? false,
    correlation: overrides.correlation || 'none',
    outcome: overrides.outcome,
    state: { ...state },
  };
};

export const recordScoreHandlerDecision = (params: {
  event: Event | null;
  state: TouchDiagnosticState;
  playerId: string;
  columnId: string;
  accepted: boolean;
  reason: string;
}) => {
  appendEntry(createEventEntry('score-handler', params.event, params.state, {
    outcome: `${params.accepted ? 'accepted' : 'rejected'}:${params.reason}`,
    scoreCell: `${params.playerId}:${params.columnId}`,
  }));
};

export const installTouchDiagnostics = (
  host: HTMLElement,
  getState: () => TouchDiagnosticState,
): (() => void) => {
  if (!isEnabled()) return () => undefined;

  const eventTypes = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'click'] as const;
  let pendingTap: { event: Event; state: TouchDiagnosticState; timer: ReturnType<typeof setTimeout> } | null = null;

  const clearPendingTap = () => {
    if (!pendingTap) return;
    clearTimeout(pendingTap.timer);
    pendingTap = null;
  };

  const isTouchLike = (event: Event) => {
    if (event.type.startsWith('touch')) return true;
    return event.type.startsWith('pointer') && (event as PointerEvent).pointerType === 'touch';
  };

  const armPendingTap = (event: Event, state: TouchDiagnosticState) => {
    clearPendingTap();
    const timer = setTimeout(() => {
      if (!pendingTap) return;
      appendEntry(createEventEntry('tap-without-click', pendingTap.event, pendingTap.state, {
        correlation: 'awaiting-click',
        outcome: `no-click-within-${CLICK_CORRELATION_WINDOW_MS}ms`,
      }));
      pendingTap = null;
    }, CLICK_CORRELATION_WINDOW_MS);
    pendingTap = { event, state, timer };
  };

  const handleEvent = (event: Event) => {
    if (!isEnabled()) return;

    const state = getState();
    if (event.type === 'click') {
      const correlation = pendingTap ? 'matched' : 'none';
      clearPendingTap();
      appendEntry(createEventEntry('click', event, state, { correlation }));
      return;
    }

    appendEntry(createEventEntry(event.type as TouchDiagnosticKind, event, state, {
      correlation: isTouchLike(event) && (event.type.endsWith('end') || event.type.endsWith('up'))
        ? 'awaiting-click'
        : 'none',
    }));

    if (event.type === 'touchcancel' || event.type === 'pointercancel') {
      clearPendingTap();
    } else if (isTouchLike(event) && (event.type === 'touchend' || event.type === 'pointerup')) {
      armPendingTap(event, state);
    }
  };

  eventTypes.forEach((eventType) => host.addEventListener(eventType, handleEvent, true));

  return () => {
    eventTypes.forEach((eventType) => host.removeEventListener(eventType, handleEvent, true));
    clearPendingTap();
  };
};

export const touchDiagnostics: TouchDiagnosticsApi = {
  isEnabled,
  enable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOUCH_DIAGNOSTICS_FLAG, '1');
      diagnosticsActive = true;
    }
  },
  disable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOUCH_DIAGNOSTICS_FLAG);
      diagnosticsActive = false;
    }
  },
  clear: () => {
    entries = [];
    sequence = 0;
    if (typeof window !== 'undefined') window.localStorage.removeItem(TOUCH_DIAGNOSTICS_ENTRIES);
  },
  getEntries: () => entries.map((entry) => ({ ...entry, state: { ...entry.state } })),
  exportJson: () => JSON.stringify(entries, null, 2),
};

if (typeof window !== 'undefined') {
  window.__scorePadTouchDiagnostics = touchDiagnostics;
}

import { describe, expect, it, vi } from 'vitest';
import { createTouchGestureGuard, suppressInvalidTouchClick, touchGestureGuard } from './touchGesture';

describe('touch gesture activation contract', () => {
  it('owns a whole multitouch round, including replacement fingers and the final lift', () => {
    const guard = createTouchGestureGuard();
    guard.start(1);
    const round = guard.getState().round;
    guard.start(2);
    guard.end(1);
    guard.start(2);
    guard.end(1);
    expect(guard.isAllowed(round)).toBe(false);
    guard.end(0);
    expect(guard.getState().active).toBe(false);
    expect(guard.isAllowed(round)).toBe(false);
    expect(guard.shouldSuppressClick({ detail: 0 })).toBe(true);
  });

  it('retains a rejected click while a new finger lands, but permits its new touchend immediately', () => {
    const guard = createTouchGestureGuard();
    guard.start(2);
    guard.end(0);
    guard.start(1);
    const round = guard.getState().round;
    expect(guard.shouldSuppressClick({})).toBe(true);
    expect(guard.isAllowed(round)).toBe(true);
    guard.end(0);
    expect(guard.shouldSuppressClick({})).toBe(false); // A native, unhandled tap.
    guard.markHandled(round);
    expect(guard.shouldSuppressClick({})).toBe(true); // Already acted at touchend.
  });

  it('rejects a late old pointer click even after a new native single-finger tap', () => {
    const guard = createTouchGestureGuard();
    guard.pointerDown({ pointerType: 'touch', pointerId: 10 });
    guard.start(1);
    guard.pointerDown({ pointerType: 'touch', pointerId: 11 });
    guard.start(2);
    guard.end(0);
    guard.pointerDown({ pointerType: 'touch', pointerId: 12 });
    guard.start(1);
    guard.end(0);
    expect(guard.shouldSuppressClick({ pointerType: 'touch', pointerId: 10 })).toBe(true);
    expect(guard.shouldSuppressClick({ pointerType: 'touch', pointerId: 12 })).toBe(false);
  });

  it('does not confuse a reused pointer id with the rejected round', () => {
    const guard = createTouchGestureGuard();
    guard.pointerDown({ pointerType: 'touch', pointerId: 1 });
    guard.start(2);
    guard.end(0);
    guard.pointerDown({ pointerType: 'touch', pointerId: 1 });
    guard.start(1);
    guard.end(0);
    expect(guard.shouldSuppressClick({ pointerType: 'touch', pointerId: 1 })).toBe(false);
  });

  it.each(['mouse', 'pen'])('allows genuine %s input without permitting an explicitly touch-origin click', (pointerType) => {
    const guard = createTouchGestureGuard();
    guard.start(2);
    guard.end(0);
    guard.pointerDown({ pointerType });
    expect(guard.shouldSuppressClick({})).toBe(false);
    expect(guard.shouldSuppressClick({ pointerType: 'touch' })).toBe(true);
  });

  it('does not treat touch-generated pointer metadata as genuine mouse evidence', () => {
    const guard = createTouchGestureGuard();
    guard.start(2);
    guard.end(0);
    guard.pointerDown({ pointerType: 'mouse', sourceCapabilities: { firesTouchEvents: true } });
    expect(guard.shouldSuppressClick({})).toBe(true);
  });

  it('allows actual keyboard and explicit non-pointing activation, not an unannotated zero-detail click', () => {
    const guard = createTouchGestureGuard();
    guard.start(2);
    guard.end(0);
    expect(guard.shouldSuppressClick({})).toBe(true);
    expect(guard.shouldSuppressClick({ pointerType: '', pointerId: -1 })).toBe(false);
    guard.keyDown({ key: 'Enter' });
    expect(guard.shouldSuppressClick({})).toBe(false);
    guard.start(1);
    expect(guard.shouldSuppressClick({})).toBe(true);
  });

  it('preserves synchronous programmatic actions without clearing the touch rejection', () => {
    const guard = createTouchGestureGuard();
    guard.start(1);
    const round = guard.getState().round;
    guard.end(0);
    guard.markHandled(round);
    guard.runAction(() => expect(guard.shouldSuppressClick({})).toBe(false));
    expect(guard.shouldSuppressClick({})).toBe(true);
    expect(() => guard.runAction(() => { throw new Error('cancelled'); })).toThrow('cancelled');
    expect(guard.shouldSuppressClick({})).toBe(true);
  });

  it('invalidates a canceled round without holding back a fresh tap', () => {
    const guard = createTouchGestureGuard();
    guard.start(1);
    const cancelledRound = guard.getState().round;
    guard.end(0, true);
    expect(guard.isAllowed(cancelledRound)).toBe(false);
    guard.start(1);
    guard.end(0);
    expect(guard.isAllowed(guard.getState().round)).toBe(true);
    expect(guard.shouldSuppressClick({})).toBe(false);
  });

  it('invalidates old handlers on cleanup and does not leak standalone touch handling across controls', () => {
    const guard = createTouchGestureGuard();
    guard.markHandled(guard.getState().round);
    expect(guard.shouldSuppressClick({})).toBe(false);
    guard.start(2);
    const round = guard.getState().round;
    guard.reset();
    expect(guard.isAllowed(round)).toBe(false);
    expect(guard.shouldSuppressClick({})).toBe(false);
  });

  it.each(['file', 'download'] as const)('preserves programmatic %s default actions independently of a later pinch', (kind) => {
    const target = kind === 'file' ? document.createElement('input') : document.createElement('a');
    if (target instanceof HTMLInputElement) target.type = 'file';
    else target.setAttribute('download', 'scores.png');
    const activated = vi.fn();
    target.addEventListener('click', event => {
      activated(event.defaultPrevented);
      event.preventDefault(); // Do not open a chooser or navigate in JSDOM.
    });
    document.body.appendChild(target);
    window.addEventListener('click', suppressInvalidTouchClick, true);
    try {
      touchGestureGuard.start(2);
      touchGestureGuard.end(0);
      target.click();
      expect(activated).toHaveBeenCalledTimes(1);
      expect(activated).toHaveBeenCalledWith(false);
    } finally {
      target.remove();
      window.removeEventListener('click', suppressInvalidTouchClick, true);
      touchGestureGuard.reset();
    }
  });
});

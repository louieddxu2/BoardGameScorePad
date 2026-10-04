import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import { useMobileZoom } from '../../hooks/useMobileZoom';
import type { ScoreColumn } from '../../types';
import ScoreCell from '../session/parts/ScoreCell';
import NumericKeypad from './NumericKeypad';
import QuickButtonPad from './QuickButtonPad';

type ControlKind = 'standard' | 'label_only' | 'keypad' | 'score-cell';
type TouchPoint = Pick<Touch, 'identifier' | 'clientX' | 'clientY' | 'target'>;
type TouchPhase = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';

const column = {
  id: 'quick', name: 'Quick', formula: 'a1', inputType: 'clicker', isScoring: true,
  quickActions: [{ id: 'one', label: 'One', value: 1 }],
} satisfies ScoreColumn;

const send = (phase: TouchPhase, target: HTMLElement, touches: TouchPoint[], changed: TouchPoint[]) => {
  fireEvent[phase](target, {
    touches, changedTouches: changed,
    targetTouches: touches.filter(touch => touch.target === target),
  });
};

const makeControl = (kind: ControlKind, stopOtherPropagation = false) => {
  const activate = vi.fn();
  const ancestorClick = vi.fn();
  renderHook(() => useMobileZoom());
  const content = kind === 'keypad' ? (
    <NumericKeypad value={0} onChange={activate} onNext={vi.fn()} column={{ ...column, inputType: 'keypad' }}
      overwrite={false} setOverwrite={vi.fn()} activeFactorIdx={0} setActiveFactorIdx={vi.fn()} playerId="p1" />
  ) : kind === 'score-cell' ? (
    <ScoreCell player={{ id: 'p1', name: 'P1', color: '#112233', scores: {}, totalScore: 0 }}
      playerIndex={0} column={{ ...column, inputType: 'keypad' }} isActive={false} onClick={activate} />
  ) : <QuickButtonPad column={{ ...column, renderMode: kind }} onAction={activate} />;
  const stop = stopOtherPropagation ? (event: React.TouchEvent) => event.stopPropagation() : undefined;
  render(
    <LanguageProvider>
      <div data-testid="control-shell" onClick={ancestorClick}>{content}</div>
      <div data-testid="other-surface" onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>Outside</div>
    </LanguageProvider>,
  );
  const target = kind === 'keypad' ? screen.getByRole('button', { name: '1' })
    : kind === 'score-cell' ? screen.getByTestId('control-shell').firstElementChild as HTMLElement
      : screen.getByRole('button', { name: kind === 'label_only' ? 'One' : /^One\s*1$/ });
  return { activate, ancestorClick, target, other: screen.getByTestId('other-surface') };
};

const beginPinch = (firstTarget: HTMLElement, secondTarget: HTMLElement, localMove = 0) => {
  let first: TouchPoint = { identifier: 1, clientX: 100, clientY: 100, target: firstTarget };
  let second: TouchPoint = { identifier: 2, clientX: 200, clientY: 100, target: secondTarget };
  send('touchStart', firstTarget, [first], [first]);
  send('touchStart', secondTarget, [first, second], [second]);
  second = { ...second, clientX: 380 };
  send('touchMove', secondTarget, [first, second], [second]);
  if (localMove) {
    first = { ...first, clientX: 100 + localMove };
    send('touchMove', firstTarget, [first, second], [first]);
  }
  expect(document.documentElement.style.fontSize).toBe('20.8px');
  return { first, second };
};

const endPinch = (first: TouchPoint, second: TouchPoint, firstEndsFirst: boolean) => {
  const [earlier, later] = firstEndsFirst ? [first, second] : [second, first];
  send('touchEnd', earlier.target as HTMLElement, [later], [earlier]);
  send('touchEnd', later.target as HTMLElement, [], [later]);
};

const tap = (target: HTMLElement) => {
  const touch = { identifier: 3, clientX: 100, clientY: 100, target };
  send('touchStart', target, [touch], [touch]);
  send('touchEnd', target, [], [touch]);
};

describe('pinch gesture ownership across touch targets', () => {
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;
  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    localStorage.removeItem('app_zoom_level');
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
  });

  // QuickButtonPad's standard and label-only variants share the same
  // QuickActionButton/useTouchAction handlers. Run the full event matrix once
  // for that component, plus the keypad and independently handled score cell.
  describe.each<ControlKind>(['standard', 'keypad', 'score-cell'])('%s control', (kind) => {
    it.each([
      { firstEndsFirst: false, localMove: 0 }, { firstEndsFirst: false, localMove: 4 },
      { firstEndsFirst: true, localMove: 0 }, { firstEndsFirst: true, localMove: 4 },
    ])('does not activate across targets, firstEndsFirst=$firstEndsFirst, localMove=$localMove', ({ firstEndsFirst, localMove }) => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(target, other, localMove);
      endPinch(first, second, firstEndsFirst);
      expect(activate).toHaveBeenCalledTimes(0);
      tap(target);
      fireEvent.click(target, { detail: 1 }); // No duplicated input after the next real tap.
      expect(activate).toHaveBeenCalledTimes(1);
    });

    it('also protects the control when the other surface stops bubbling', () => {
      const { activate, target, other } = makeControl(kind, true);
      const { first, second } = beginPinch(target, other);
      endPinch(first, second, false);
      expect(activate).toHaveBeenCalledTimes(0);
    });

    it('rejects a compatibility click after two fingers on the same control', () => {
      const { activate, target } = makeControl(kind);
      const { first, second } = beginPinch(target, target);
      endPinch(first, second, false);
      fireEvent.click(target, { detail: 1 });
      expect(activate).toHaveBeenCalledTimes(0);
      tap(target);
      expect(activate).toHaveBeenCalledTimes(1);
    });

    it('does not rearm if one finger is replaced before the remaining finger lifts', () => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(other, target);
      send('touchEnd', target, [first], [second]);
      const replacement = { ...second, identifier: 3 };
      send('touchStart', target, [first, replacement], [replacement]);
      send('touchEnd', other, [replacement], [first]);
      send('touchEnd', target, [], [replacement]);
      expect(activate).toHaveBeenCalledTimes(0);
      tap(target);
      expect(activate).toHaveBeenCalledTimes(1);
    });

    it('keeps keyboard, genuine mouse and pen activation working after a pinch', () => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(other, target);
      endPinch(first, second, false);
      expect(activate).toHaveBeenCalledTimes(0);
      fireEvent.keyDown(target, { key: 'Enter' });
      fireEvent.click(target, { detail: 0 }); // Native activation following a real key.
      fireEvent.keyUp(target, { key: 'Enter' });
      expect(activate).toHaveBeenCalledTimes(1);
      let activationCount = 1;
      for (const pointerType of ['mouse', 'pen']) {
        const pointerDown = new Event('pointerdown', { bubbles: true });
        Object.defineProperty(pointerDown, 'pointerType', { value: pointerType });
        fireEvent(target, pointerDown);
        fireEvent.click(target, { detail: 1 }); // Legacy click without pointerType.
        expect(activate).toHaveBeenCalledTimes(++activationCount);

        const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
        Object.defineProperty(click, 'pointerType', { value: pointerType });
        fireEvent(target, click);
        expect(activate).toHaveBeenCalledTimes(++activationCount);
      }
      const mouseClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      Object.defineProperty(mouseClick, 'sourceCapabilities', { value: { firesTouchEvents: false } });
      fireEvent(target, mouseClick);
      expect(activate).toHaveBeenCalledTimes(++activationCount);
    });

    it('cancels the remaining touch without an input or a later touch-origin click', () => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(target, other);
      send('touchCancel', other, [first], [second]);
      send('touchCancel', target, [], [first]);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      Object.defineProperty(click, 'sourceCapabilities', { value: { firesTouchEvents: true } });
      fireEvent(target, click);
      expect(activate).toHaveBeenCalledTimes(0);
      tap(target);
      expect(activate).toHaveBeenCalledTimes(1);
    });

    it('recognizes a touch-origin PointerEvent click even with detail zero', () => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(target, other);
      endPinch(first, second, false);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
      Object.defineProperty(click, 'pointerType', { value: 'touch' });
      fireEvent(target, click);
      expect(activate).toHaveBeenCalledTimes(0);
      expect(click.defaultPrevented).toBe(true);
    });

    it.each([0, 1])('rejects a pinch click without source metadata, detail=%s', (detail) => {
      const { activate, ancestorClick, target, other } = makeControl(kind);
      const { first, second } = beginPinch(target, other);
      endPinch(first, second, false);
      fireEvent.click(target, { detail });
      expect(activate).not.toHaveBeenCalled();
      expect(ancestorClick).not.toHaveBeenCalled();
    });

    it.each([false, true])('accepts every rapid tap without a cooldown, compatibilityClick=%s', (compatibilityClick) => {
      const { activate, target, other } = makeControl(kind);
      const { first, second } = beginPinch(target, other);
      endPinch(first, second, false);
      for (let index = 1; index <= 20; index++) {
        tap(target);
        if (compatibilityClick) fireEvent.click(target, { detail: 1 });
        expect(activate).toHaveBeenCalledTimes(index);
      }
    });
  });

  it.each([false, true])('keeps label-only pinch release inert with firstEndsFirst=%s', (firstEndsFirst) => {
    const { activate, target, other } = makeControl('label_only');
    const { first, second } = beginPinch(target, other);
    endPinch(first, second, firstEndsFirst);
    fireEvent.click(target, { detail: 1 });
    expect(activate).not.toHaveBeenCalled();
    tap(target);
    fireEvent.click(target, { detail: 1 });
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(column.quickActions[0]);
  });

  it('rejects a pinch click retargeted to a different keypad key', () => {
    const { activate, target, other } = makeControl('keypad');
    const { first, second } = beginPinch(target, other);
    endPinch(first, second, false);
    const nextKey = screen.getByRole('button', { name: '2' });
    fireEvent.click(nextKey, { detail: 1 });
    expect(activate).toHaveBeenCalledTimes(0);
    tap(nextKey);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith({ value: 2, history: ['2'] });
  });

  it('does not let a canceled pinch click activate an ancestor', () => {
    const { activate, ancestorClick, target, other } = makeControl('keypad');
    const { first, second } = beginPinch(other, target);
    endPinch(first, second, false);
    fireEvent.click(target, { detail: 1 });
    expect(activate).toHaveBeenCalledTimes(0);
    expect(ancestorClick).toHaveBeenCalledTimes(0);
  });

  it('does not activate a key for a different ending touch identifier', () => {
    const { activate, target } = makeControl('keypad');
    const first = { identifier: 1, clientX: 100, clientY: 100, target };
    send('touchStart', target, [first], [first]);
    send('touchEnd', target, [], [{ ...first, identifier: 2 }]);
    expect(activate).toHaveBeenCalledTimes(0);
    tap(target);
    expect(activate).toHaveBeenCalledTimes(1);
  });
});

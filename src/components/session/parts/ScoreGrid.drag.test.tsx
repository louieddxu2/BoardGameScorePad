import React, { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import type { GameTemplate } from '../../../types';
import ScoreGrid from './ScoreGrid';

const template: GameTemplate = { id: 'drag-test', name: 'Drag', createdAt: 1, columns: [
  { id: 'one', name: 'One', inputType: 'keypad', formula: 'a1', isScoring: true },
  { id: 'two', name: 'Two', inputType: 'keypad', formula: 'a1', isScoring: true },
] };
const Harness = ({ update }: { update: (template: GameTemplate) => void }) => {
  useMobileZoom();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentTemplate, setCurrentTemplate] = useState(template);
  return <LanguageProvider><div ref={scrollRef} data-testid="scroller">
    <ScoreGrid template={currentTemplate} session={{
      id: 'session', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [],
    }} editingCell={null} editingPlayerId={null}
      onCellClick={() => {}} onPlayerHeaderClick={() => {}} onColumnHeaderClick={() => {}}
      onUpdateTemplate={next => { setCurrentTemplate(next); update(next); }}
      onAddColumn={() => {}} scrollContainerRef={scrollRef}
      contentRef={contentRef} isEditMode={true} zoomLevel={1} panelDockOffset="0px" />
  </div><div data-testid="outside" /></LanguageProvider>;
};

const first = { identifier: 1, clientX: 100, clientY: 100 };
const second = { identifier: 2, clientX: 200, clientY: 100 };
const setupGrid = () => {
  const update = vi.fn();
  const view = render(<Harness update={update} />);
  const from = view.container.querySelector('#row-one [draggable="true"]') as HTMLElement;
  const to = view.container.querySelector('#row-two') as HTMLElement;
  const scroller = view.getByTestId('scroller');
  Object.defineProperty(scroller, 'getBoundingClientRect', {
    value: () => ({
      top: 0, bottom: 500, left: 0, right: 500, width: 500, height: 500, x: 0, y: 0, toJSON: () => ({}),
    }),
  });
  const dataTransfer = { effectAllowed: 'uninitialized' };
  const hasDropLine = () => to.querySelector('.bg-brand-primary.pointer-events-none') !== null;
  return { ...view, update, from, to, scroller, dataTransfer, hasDropLine };
};
const touchStart = (from: HTMLElement) => {
  fireEvent.touchStart(from, { touches: [first], changedTouches: [first] });
};
const dragOver = (target: HTMLElement, dataTransfer: { effectAllowed: string }, clientY = 120) => {
  // JSDOM lacks DragEvent; an explicit MouseEvent preserves drag coordinates.
  const event = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  fireEvent(target, event);
};
const touchMoveTo = (from: HTMLElement, to: HTMLElement) => {
  document.elementFromPoint = vi.fn(() => to.querySelector('[draggable="true"]'));
  const moved = { ...first, clientY: 120 };
  fireEvent.touchMove(from, { touches: [moved], changedTouches: [moved] });
};
const expectReorderedOnce = (update: ReturnType<typeof vi.fn>) => {
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0].columns.map((column: { id: string }) => column.id)).toEqual(['two', 'one']);
  expect(Array.from(document.querySelectorAll('#row-one, #row-two'))
    .map(row => row.getAttribute('data-row-id'))).toEqual(['two', 'one']);
};

describe('actual score grid drag ownership', () => {
  let originalElementFromPoint: typeof document.elementFromPoint;
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;
  beforeEach(() => {
    vi.useFakeTimers();
    originalElementFromPoint = document.elementFromPoint;
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    localStorage.removeItem('app_zoom_level');
  });
  afterEach(() => {
    cleanup();
    document.elementFromPoint = originalElementFromPoint;
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
    vi.useRealTimers();
  });

  it('keeps native mouse dragging, the drop line and reordering working', () => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer);
    expect(hasDropLine()).toBe(true);
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expectReorderedOnce(update);
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { held: false, cancelBeforeNative: false }, { held: true, cancelBeforeNative: false },
    { held: false, cancelBeforeNative: true }, { held: true, cancelBeforeNative: true },
  ])('preserves native handoff, held=$held, cancelBeforeNative=$cancelBeforeNative', ({ held, cancelBeforeNative }) => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    if (held) act(() => { vi.advanceTimersByTime(500); });
    const cancel = () => fireEvent.touchCancel(from, { touches: [], changedTouches: [first] });
    if (cancelBeforeNative) cancel();
    fireEvent.dragStart(from, { dataTransfer });
    if (!cancelBeforeNative) cancel();
    fireEvent.touchMove(from, { touches: [first], changedTouches: [first] });
    // A pending long press must not replace the browser-owned drag later.
    act(() => { vi.advanceTimersByTime(500); });
    dragOver(to, dataTransfer);
    expect(hasDropLine()).toBe(true);
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expectReorderedOnce(update);
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let a trailing touchend finish or erase a native drag', () => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer);
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first] });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(true);
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expectReorderedOnce(update);
  });

  it('preserves native auto-scroll through handoff and cleans it up on dragend', () => {
    const { from, to, scroller, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer, 490);
    fireEvent.touchCancel(from, { touches: [], changedTouches: [first] });
    act(() => { vi.advanceTimersByTime(32); });
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(hasDropLine()).toBe(true);
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first] });
    expectReorderedOnce(update);
  });

  it('still shows a line and reorders exactly once for a touch-only long press', () => {
    const { from, to, update, hasDropLine } = setupGrid();
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    expect(hasDropLine()).toBe(true);
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first] });
    expectReorderedOnce(update);
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not accept a native drop after a touch-only drag was canceled', () => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    fireEvent.touchCancel(from, { touches: [], changedTouches: [first] });
    dragOver(to, dataTransfer);
    fireEvent.drop(to, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not reorder after a touch-only drag becomes an outside pinch', () => {
    const { from, to, update, getByTestId, hasDropLine } = setupGrid();
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    const outside = getByTestId('outside');
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
    fireEvent.touchEnd(outside, { touches: [first], changedTouches: [second] });
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first] });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let a native drop commit a touch-only drag without native dragstart', () => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    fireEvent.drop(to, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(true);
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first] });
    expectReorderedOnce(update);
  });

  it.each(['touchStart', 'touchCancel'] as const)('cancels a native drag on a real multitouch interruption via %s', (phase) => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    touchStart(from);
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer);
    fireEvent[phase](from, {
      touches: phase === 'touchStart' ? [first, second] : [second], changedTouches: [first],
    });
    fireEvent.touchEnd(from, { touches: [], changedTouches: [first, second] });
    dragOver(to, dataTransfer);
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up native auto-scroll when the real grid unmounts', () => {
    const { from, to, dataTransfer, unmount } = setupGrid();
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer, 490);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['drop', 'auto-scroll'] as const)('rejects %s after an outside pinch, even after all fingers lift', (operation) => {
    const { from, to, scroller, dataTransfer, update, getByTestId, hasDropLine } = setupGrid();
    touchStart(from);
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.touchCancel(from, { touches: [], changedTouches: [first] });
    dragOver(to, dataTransfer, operation === 'auto-scroll' ? 490 : 120);
    const outside = getByTestId('outside');
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
    fireEvent.touchEnd(outside, { touches: [], changedTouches: [first, second] });
    if (operation === 'auto-scroll') {
      act(() => { vi.advanceTimersByTime(32); });
      expect(scroller.scrollTop).toBe(0);
    }
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not begin a native drag while the source touch is already a pinch', () => {
    const { from, to, dataTransfer, update, hasDropLine } = setupGrid();
    fireEvent.touchStart(from, { touches: [first, second], changedTouches: [first, second] });
    expect(fireEvent.dragStart(from, { dataTransfer })).toBe(false);
    dragOver(to, dataTransfer);
    fireEvent.drop(to, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

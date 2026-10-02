import React, { useEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import type { GameTemplate } from '../../../types';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import ScoreGrid from './ScoreGrid';

const template: GameTemplate = { id: 'drag-test', name: 'Drag', createdAt: 1, columns: [
  { id: 'one', name: 'One', inputType: 'keypad', formula: 'a1', isScoring: true },
  { id: 'two', name: 'Two', inputType: 'keypad', formula: 'a1', isScoring: true },
] };
const longTemplate: GameTemplate = { ...template, columns: [...template.columns,
  ...['three', 'four', 'five'].map(id => ({ ...template.columns[0], id, name: id })),
] };
const Harness = ({ update, activate, initialTemplate, isEditMode }: {
  update: (template: GameTemplate) => void;
  activate: () => void;
  initialTemplate: GameTemplate;
  isEditMode: boolean;
}) => {
  useMobileZoom();
  // Mirror App's existing capture listener, including compatibility clicks.
  useEffect(() => {
    window.addEventListener('click', suppressInvalidTouchClick, true);
    return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentTemplate, setCurrentTemplate] = useState(initialTemplate);
  return <LanguageProvider><div ref={scrollRef} data-testid="scroller">
    <ScoreGrid template={currentTemplate} session={{
      id: 'session', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [
        { id: 'player', name: 'Alice', color: '#ff0000', scores: {}, totalScore: 0 },
      ],
    }} editingCell={null} editingPlayerId={null}
      onCellClick={activate} onPlayerHeaderClick={activate} onColumnHeaderClick={activate}
      onUpdateTemplate={next => { setCurrentTemplate(next); update(next); }}
      onAddColumn={activate} onOpenBatchAdd={activate} onOpenSettings={activate}
      onToggleToolbox={activate} scrollContainerRef={scrollRef}
      contentRef={contentRef} isEditMode={isEditMode} zoomLevel={1} panelDockOffset="0px" />
  </div><div data-testid="outside" /></LanguageProvider>;
};

const first = { identifier: 1, clientX: 100, clientY: 100 };
const second = { identifier: 2, clientX: 200, clientY: 100 };
const setupGrid = ({ initialTemplate = template, isEditMode = true }: {
  initialTemplate?: GameTemplate;
  isEditMode?: boolean;
} = {}) => {
  const update = vi.fn();
  const activate = vi.fn();
  const view = render(<Harness update={update} activate={activate}
    initialTemplate={initialTemplate} isEditMode={isEditMode} />);
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
  return { ...view, update, activate, from, to, scroller, dataTransfer, hasDropLine };
};
const touchStart = (from: HTMLElement) => {
  fireEvent.touchStart(from, { touches: [first], changedTouches: [first] });
};
const dragOver = (target: Element, dataTransfer: { effectAllowed: string }, clientY = 120) => {
  // JSDOM lacks DragEvent; an explicit MouseEvent preserves drag coordinates.
  const event = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  fireEvent(target, event);
  return event;
};
const touchMoveTo = (from: HTMLElement, to: HTMLElement) => {
  document.elementFromPoint = vi.fn(() => to.querySelector('[draggable="true"]'));
  const moved = { ...first, clientY: 120 };
  fireEvent.touchMove(from, { touches: [moved], changedTouches: [moved] });
};
const expectReorderedOnce = (update: ReturnType<typeof vi.fn>, expectedIds = ['two', 'one']) => {
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0].columns.map((column: { id: string }) => column.id)).toEqual(expectedIds);
  expect(Array.from(document.querySelectorAll('#row-one, #row-two'))
    .map(row => row.getAttribute('data-row-id'))).toEqual(['two', 'one']);
};

describe('actual score grid drag ownership', () => {
  let originalElementFromPoint: typeof document.elementFromPoint;
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;
  let previousLanguage: string | null;
  beforeEach(() => {
    vi.useFakeTimers();
    originalElementFromPoint = document.elementFromPoint;
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    localStorage.removeItem('app_zoom_level');
    previousLanguage = localStorage.getItem('app_language');
    localStorage.setItem('app_language', 'en');
  });
  afterEach(() => {
    cleanup();
    document.elementFromPoint = originalElementFromPoint;
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
    if (previousLanguage === null) localStorage.removeItem('app_language');
    else localStorage.setItem('app_language', previousLanguage);
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

  it.each(['add', 'copy', 'toolbox', 'player', 'settings', 'footer space', 'content', 'viewport'])
    ('drops at the shown line when released over %s instead of a row', (area) => {
      const grid = setupGrid({ initialTemplate: area === 'toolbox' ? longTemplate : template });
      const { from, to, dataTransfer, update, activate, hasDropLine } = grid;
      const add = grid.getByRole('button', { name: 'Create new blank item' });
      const targets: Record<string, () => Element> = {
        add: () => add.querySelector('svg')!,
        copy: () => grid.getByRole('button', { name: 'Copy existing:' }),
        toolbox: () => grid.getByTitle('Toggle Toolbox'),
        player: () => grid.container.querySelector('#header-player')!,
        settings: () => grid.getByText('Player'),
        'footer space': () => add.closest('.animate-in')!.children[1],
        content: () => grid.container.querySelector('#live-grid-container')!,
        viewport: () => grid.container.querySelector('#live-grid-container')!.parentElement!,
      };
      const target = targets[area]();
      fireEvent.dragStart(from, { dataTransfer });
      dragOver(to, dataTransfer);
      expect(hasDropLine()).toBe(true);
      expect(dragOver(target, dataTransfer).defaultPrevented).toBe(true);
      expect(hasDropLine()).toBe(true);
      fireEvent.drop(target, { dataTransfer });
      fireEvent.dragEnd(from, { dataTransfer });
      expectReorderedOnce(update, area === 'toolbox' ? ['two', 'one', 'three', 'four', 'five'] : undefined);
      expect(activate).not.toHaveBeenCalled();
      expect(hasDropLine()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

  it('suppresses a touch drag release click on a control but accepts the next tap immediately', () => {
    const { from, to, update, activate, getByRole, hasDropLine } = setupGrid();
    const add = getByRole('button', { name: 'Create new blank item' });
    touchStart(from);
    act(() => { vi.advanceTimersByTime(500); });
    touchMoveTo(from, to);
    // Controls have no row id: keep the existing line while the finger crosses them.
    document.elementFromPoint = vi.fn(() => add.querySelector('svg'));
    fireEvent.touchMove(from, { touches: [first], changedTouches: [first] });
    expect(hasDropLine()).toBe(true);
    expect(fireEvent.touchEnd(from, { touches: [], changedTouches: [first] })).toBe(false);
    expectReorderedOnce(update);
    expect(fireEvent.click(add)).toBe(false);
    expect(activate).not.toHaveBeenCalled();
    fireEvent.touchStart(add, { touches: [first], changedTouches: [first] });
    fireEvent.touchEnd(add, { touches: [], changedTouches: [first] });
    fireEvent.click(add);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves native touch handoff and auto-scroll over footer controls', () => {
    const { from, to, dataTransfer, update, activate, scroller, getByRole, hasDropLine } = setupGrid();
    const add = getByRole('button', { name: 'Create new blank item' });
    touchStart(from);
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.touchCancel(from, { touches: [], changedTouches: [first] });
    dragOver(to, dataTransfer);
    expect(dragOver(add, dataTransfer, 490).defaultPrevented).toBe(true);
    act(() => { vi.advanceTimersByTime(32); });
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(hasDropLine()).toBe(true);
    fireEvent.drop(add, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expectReorderedOnce(update);
    expect(fireEvent.click(add)).toBe(false);
    expect(activate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a control-area drop after an outside pinch invalidates the native drag', () => {
    const { from, to, dataTransfer, update, activate, getByRole, getByTestId, hasDropLine } = setupGrid();
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer);
    const outside = getByTestId('outside');
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [first, second] });
    fireEvent.touchEnd(outside, { touches: [], changedTouches: [first, second] });
    const add = getByRole('button', { name: 'Create new blank item' });
    expect(dragOver(add, dataTransfer).defaultPrevented).toBe(false);
    fireEvent.drop(add, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(hasDropLine()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not invent a new insertion target when dragged straight onto a control', () => {
    const { from, dataTransfer, update, activate, getByRole, hasDropLine } = setupGrid();
    const add = getByRole('button', { name: 'Create new blank item' });
    fireEvent.dragStart(from, { dataTransfer });
    expect(dragOver(add, dataTransfer).defaultPrevented).toBe(true);
    expect(hasDropLine()).toBe(false);
    fireEvent.drop(add, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not accept foreign drops or affect ordinary control clicks', () => {
    const { update, activate, getByRole, dataTransfer } = setupGrid();
    const add = getByRole('button', { name: 'Create new blank item' });
    expect(dragOver(add, dataTransfer).defaultPrevented).toBe(false);
    expect(fireEvent.drop(add, { dataTransfer })).toBe(true);
    fireEvent.click(add);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a native drag dropped outside the grid even with a visible line', () => {
    const { from, to, dataTransfer, update, hasDropLine, getByTestId } = setupGrid();
    fireEvent.dragStart(from, { dataTransfer });
    dragOver(to, dataTransfer);
    expect(hasDropLine()).toBe(true);
    const outside = getByTestId('outside');
    expect(dragOver(outside, dataTransfer).defaultPrevented).toBe(false);
    fireEvent.drop(outside, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
    expect(update).not.toHaveBeenCalled();
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

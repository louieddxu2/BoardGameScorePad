import React, { useRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import type { GameTemplate } from '../../../types';
import { useColumnDragAndDrop } from './useColumnDragAndDrop';

const template: GameTemplate = { id: 'drag-test', name: 'Drag', createdAt: 1, columns: [
  { id: 'one', name: 'One', inputType: 'keypad', formula: 'a1', isScoring: true },
  { id: 'two', name: 'Two', inputType: 'keypad', formula: 'a1', isScoring: true },
] };

const Harness = ({ update }: { update: (template: GameTemplate) => void }) => {
  useMobileZoom();
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useColumnDragAndDrop({ template, onUpdateTemplate: update, scrollRef });
  return <><div ref={scrollRef} data-testid="scroller">
    {template.columns.map(column => <div key={column.id} data-row-id={column.id}
      onTouchStart={e => drag.handleTouchStart(e, column.id)} onTouchMove={drag.handleTouchMove}
      onTouchEnd={drag.handleTouchEnd} onTouchCancel={drag.handleTouchCancel}>{column.name}</div>)}
    <span data-testid="dragging">{drag.draggingId ?? 'none'}</span>
  </div><div data-testid="outside" /></>;
};

const first = { identifier: 1, clientX: 100, clientY: 100 };
const second = { identifier: 2, clientX: 200, clientY: 100 };
const hold = (row: HTMLElement) => {
  fireEvent.touchStart(row, { touches: [first], changedTouches: [first] });
  act(() => { vi.advanceTimersByTime(500); });
};
const moveToSecondRow = (row: HTMLElement) => {
  document.elementFromPoint = vi.fn(() => screen.getByText('Two'));
  const moved = { ...first, clientY: 120 };
  fireEvent.touchMove(row, { touches: [moved], changedTouches: [moved] });
};

describe('column drag touch qualification and cleanup', () => {
  let originalElementFromPoint: typeof document.elementFromPoint;
  beforeEach(() => {
    vi.useFakeTimers();
    originalElementFromPoint = document.elementFromPoint;
  });
  afterEach(() => {
    cleanup();
    document.elementFromPoint = originalElementFromPoint;
    vi.useRealTimers();
  });

  it('does not start the long press when another target joins a pinch', () => {
    const update = vi.fn();
    render(<Harness update={update} />);
    const row = screen.getByText('One');
    const outside = screen.getByTestId('outside');
    fireEvent.touchStart(row, { touches: [first], changedTouches: [first] });
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('dragging')).toHaveTextContent('none');
    fireEvent.touchEnd(outside, { touches: [first], changedTouches: [second] });
    fireEvent.touchEnd(row, { touches: [], changedTouches: [first] });
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops auto-scroll and does not reorder when an active drag becomes a pinch', () => {
    const update = vi.fn();
    render(<Harness update={update} />);
    const row = screen.getByText('One');
    const outside = screen.getByTestId('outside');
    hold(row);
    expect(screen.getByTestId('dragging')).toHaveTextContent('one');
    moveToSecondRow(row);
    const scroller = screen.getByTestId('scroller');
    const scrollTop = scroller.scrollTop;
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
    act(() => { vi.advanceTimersByTime(32); });
    expect(scroller.scrollTop).toBe(scrollTop);
    fireEvent.touchEnd(outside, { touches: [first], changedTouches: [second] });
    fireEvent.touchEnd(row, { touches: [], changedTouches: [first] });
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByTestId('dragging')).toHaveTextContent('none');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels without reordering and permits a fresh normal drag immediately', () => {
    const update = vi.fn();
    render(<Harness update={update} />);
    const row = screen.getByText('One');
    hold(row);
    moveToSecondRow(row);
    fireEvent.touchCancel(row, { touches: [], changedTouches: [first] });
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    hold(row);
    moveToSecondRow(row);
    fireEvent.touchEnd(row, { touches: [], changedTouches: [first] });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].columns.map((column: { id: string }) => column.id)).toEqual(['two', 'one']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up a pending long press when the component unmounts', () => {
    const update = vi.fn();
    const { unmount } = render(<Harness update={update} />);
    fireEvent.touchStart(screen.getByText('One'), { touches: [first], changedTouches: [first] });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(500); });
    expect(update).not.toHaveBeenCalled();
  });
});

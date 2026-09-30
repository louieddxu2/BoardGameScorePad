import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useToolboxBoundaryGesture } from './useToolboxBoundaryGesture';

const GestureHarness: React.FC<{ initiallyOpen?: boolean; blocked?: boolean }> = ({ initiallyOpen = false, blocked = false }) => {
  const [isToolboxOpen, setIsToolboxOpen] = useState(initiallyOpen);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useToolboxBoundaryGesture({
    scrollContainerRef,
    isToolboxOpen,
    canAutoOpenToolbox: true,
    isInputInterfaceOpen: blocked,
    onAutoOpen: () => setIsToolboxOpen(true),
    onAutoClose: () => setIsToolboxOpen(false),
  });

  return (
    <div
      ref={scrollContainerRef}
      data-testid="scroll-container"
      style={{ overflow: 'auto' }}
    >
      <div style={{ height: 1000 }} />
      <span>{isToolboxOpen ? 'open' : 'closed'}</span>
    </div>
  );
};

const setScrollTop = (element: HTMLElement, value: number) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 1000 },
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value,
  });
};

const swipeOn = (element: HTMLElement, startY: number, endY: number) => {
  act(() => {
    fireEvent.touchStart(element, {
      touches: [{ clientX: 120, clientY: startY }],
    });
    fireEvent.touchMove(element, {
      touches: [{ clientX: 120, clientY: endY }],
    });
    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: 120, clientY: endY }],
    });
  });
};

describe('useToolboxBoundaryGesture', () => {
  it('opens at the bottom boundary when an upward swipe cannot scroll further', () => {
    render(<GestureHarness />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 700);
    swipeOn(scroller, 200, 130);

    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('requires the swipe to start at the bottom even if no scroll is reported during it', () => {
    render(<GestureHarness />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 500);
    swipeOn(scroller, 200, 130);
    expect(screen.getByText('closed')).toBeInTheDocument();

    setScrollTop(scroller, 700);
    swipeOn(scroller, 200, 130);
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('does not open when an upward swipe first reaches the bottom', () => {
    render(<GestureHarness />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 500);
    act(() => {
      fireEvent.touchStart(scroller, { touches: [{ clientX: 120, clientY: 200 }] });
      setScrollTop(scroller, 700);
      fireEvent.touchMove(scroller, { touches: [{ clientX: 120, clientY: 130 }] });
      fireEvent.touchEnd(scroller, { changedTouches: [{ clientX: 120, clientY: 130 }] });
    });

    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('does not open if content grows below the touch-start boundary before release', () => {
    render(<GestureHarness />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 0);
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 300 });
    act(() => {
      fireEvent.touchStart(scroller, { touches: [{ clientX: 120, clientY: 200 }] });
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 });
      fireEvent.touchMove(scroller, { touches: [{ clientX: 120, clientY: 130 }] });
      fireEvent.touchEnd(scroller, { changedTouches: [{ clientX: 120, clientY: 130 }] });
    });

    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('closes an auto-opened toolbox at the top boundary', () => {
    render(<GestureHarness />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 700);
    swipeOn(scroller, 200, 130);
    expect(screen.getByText('open')).toBeInTheDocument();

    setScrollTop(scroller, 0);
    act(() => fireEvent.scroll(scroller));

    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('does not open while another input interface is active', () => {
    render(<GestureHarness blocked />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 700);
    swipeOn(scroller, 200, 130);

    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('does not close a manually opened toolbox at the top boundary', () => {
    render(<GestureHarness initiallyOpen />);
    const scroller = screen.getByTestId('scroll-container');

    setScrollTop(scroller, 0);
    swipeOn(scroller, 130, 200);

    expect(screen.getByText('open')).toBeInTheDocument();
  });
});

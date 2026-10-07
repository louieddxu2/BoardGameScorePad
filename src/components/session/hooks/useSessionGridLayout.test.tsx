import React from 'react';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate } from '../../../types';
import { measureSessionScreenshotLayout, useSessionGridAlignment, useSessionItemWidth } from './useSessionGridLayout';

const columns: GameTemplate['columns'] = ['points', 'bonus', 'hidden'].map(id => ({
  id, name: id, formula: 'a1', inputType: 'keypad', isScoring: true,
}));

const size = (element: HTMLElement, width: number, height: number) => {
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: width },
    offsetHeight: { configurable: true, value: height },
  });
};

const widthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'innerWidth', widthDescriptor);
});

describe('session grid layout', () => {
  it('measures visible header, player and score row sizes, but rejects a board without player headers', () => {
    expect(measureSessionScreenshotLayout(columns)).toBeNull();
    const { container } = render(<div>
      <div id="live-player-header-row">
        <div data-testid="item-header" />
        <div data-player-header-id="p1" />
        <div data-player-header-id="p2" />
      </div>
      <div id="row-points" />
      <div id="row-bonus" />
      <div id="live-totals-bar" />
    </div>);
    size(container.querySelector('#live-player-header-row')!, 320, 41);
    size(container.querySelector('[data-testid="item-header"]')!, 84, 41);
    size(container.querySelector('[data-player-header-id="p1"]')!, 96, 41);
    size(container.querySelector('[data-player-header-id="p2"]')!, 128, 41);
    size(container.querySelector('#row-points')!, 320, 52);
    size(container.querySelector('#row-bonus')!, 320, 64);
    size(container.querySelector('#live-totals-bar')!, 320, 38);

    expect(measureSessionScreenshotLayout(columns)).toEqual({
      itemWidth: 84, playerWidths: { p1: 96, p2: 128 }, playerHeaderHeight: 41,
      rowHeights: { points: 52, bonus: 64 }, totalRowHeight: 38,
    });
    container.querySelector('#live-totals-bar')!.remove();
    expect(measureSessionScreenshotLayout(columns)?.totalRowHeight).toBeUndefined();
    container.querySelectorAll('[data-player-header-id]').forEach(element => element.remove());
    expect(measureSessionScreenshotLayout(columns)).toBeNull();
  });

  it('updates the item width for player count and viewport size without registering another resize listener', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 400 });
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { result, rerender, unmount } = renderHook(({ playerCount }) => useSessionItemWidth(playerCount), { initialProps: { playerCount: 2 } });
    expect(result.current).toBe(100);
    rerender({ playerCount: 4 });
    expect(result.current).toBe(70);
    act(() => {
      window.innerWidth = 800;
      fireEvent(window, new Event('resize'));
    });
    expect(result.current).toBeCloseTo(800 / 6);
    const resizeCalls = add.mock.calls.filter(([event]) => event === 'resize');
    expect(resizeCalls).toHaveLength(1);
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', resizeCalls[0][1]);
  });

  it('aligns the totals scroll and content width, retaining one observer and cleaning up on unmount', () => {
    const refs = {
      tableContainerRef: React.createRef<HTMLDivElement>(), totalBarScrollRef: React.createRef<HTMLDivElement>(),
      gridContentRef: React.createRef<HTMLDivElement>(), totalContentRef: React.createRef<HTMLDivElement>(),
    };
    const { container } = render(<div>
      <div id="live-player-header-row"><div /></div>
      <div ref={refs.tableContainerRef}><div ref={refs.gridContentRef} /></div>
      <div ref={refs.totalBarScrollRef}><div ref={refs.totalContentRef} /></div>
    </div>);
    const grid = refs.tableContainerRef.current!;
    const bar = refs.totalBarScrollRef.current!;
    const gridContent = refs.gridContentRef.current!;
    const totalContent = refs.totalContentRef.current!;
    size(container.querySelector('#live-player-header-row > div')!, 80, 40);
    size(gridContent, 400, 300);
    let resized!: ResizeObserverCallback;
    let observer!: ResizeObserver;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class Observer implements ResizeObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      constructor(callback: ResizeObserverCallback) { resized = callback; observer = this; }
    }
    vi.stubGlobal('ResizeObserver', Observer);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
    const { rerender, unmount } = renderHook(() => useSessionGridAlignment(refs));
    rerender();
    expect(observe).toHaveBeenCalledExactlyOnceWith(gridContent);

    grid.scrollLeft = 72;
    fireEvent.scroll(grid);
    expect(bar.scrollLeft).toBe(72);
    const resizeContent = () => {
      act(() => {
        resized([{
          target: gridContent, contentRect: gridContent.getBoundingClientRect(),
          borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [],
        }], observer);
        frames.shift()!(0);
      });
    };
    resizeContent();
    expect(totalContent.style.width).toBe('320px');
    container.querySelector('#live-player-header-row')!.remove();
    resizeContent();
    expect(totalContent.style.width).toBe('330px');
    size(gridContent, 50, 300);
    resizeContent();
    expect(totalContent.style.width).toBe('0px');

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    grid.scrollLeft = 99;
    fireEvent.scroll(grid);
    expect(bar.scrollLeft).toBe(72);
  });
});

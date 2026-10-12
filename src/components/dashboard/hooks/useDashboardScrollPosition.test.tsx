import React, { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDashboardScrollPosition } from './useDashboardScrollPosition';

const ScrollHarness = ({ mode, query = '', hidden = false, onRender }: {
  mode: 'library' | 'history'; query?: string; hidden?: boolean; onRender?: () => void;
}) => {
  onRender?.();
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = useDashboardScrollPosition(ref, mode, query);
  return <div ref={ref} data-testid="scroll" onScroll={onScroll} className={hidden ? 'invisible' : ''}>
    <div>{mode}: {query}</div>
  </div>;
};

const scrollTo = (top: number) => {
  const container = screen.getByTestId('scroll');
  container.scrollTop = top;
  fireEvent.scroll(container);
};

describe('dashboard scroll context', () => {
  it('restores independent positions without scroll renders or changing detail-return context', () => {
    const onRender = vi.fn();
    const { rerender } = render(<ScrollHarness mode="library" onRender={onRender} />);
    scrollTo(250);
    expect(onRender).toHaveBeenCalledOnce();
    rerender(<ScrollHarness mode="history" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(0);
    scrollTo(430);
    rerender(<ScrollHarness mode="history" hidden />);
    rerender(<ScrollHarness mode="history" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(430);
    rerender(<ScrollHarness mode="library" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(250);
    rerender(<ScrollHarness mode="history" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(430);
  });

  it('invalidates both positions when search changes, including the inactive mode', () => {
    const { rerender } = render(<ScrollHarness mode="library" />);
    scrollTo(250);
    rerender(<ScrollHarness mode="history" />);
    scrollTo(430);
    rerender(<ScrollHarness mode="history" query="Sky" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(0);
    scrollTo(80);
    rerender(<ScrollHarness mode="library" query="Sky" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(0);
    rerender(<ScrollHarness mode="history" query="Sky" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(80);
    rerender(<ScrollHarness mode="history" query="" />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(0);
  });
});

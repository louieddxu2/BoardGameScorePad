import React, { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileZoom } from './useMobileZoom';
import { usePullAction } from './usePullAction';

const PullHarness = ({ search, cloud, disabled = false }: {
  search: () => void; cloud: () => void; disabled?: boolean;
}) => {
  useMobileZoom();
  const ref = useRef<HTMLDivElement>(null);
  // Deliberately unstable callbacks: visual renders must preserve the gesture.
  const pull = usePullAction(ref, { onTriggerSearch: () => search(), onTriggerCloud: () => cloud(), disabled });
  return <><div ref={ref} data-testid="pull"><output>{pull.activeState}</output></div>
    <div data-testid="outside" onTouchStart={event => event.stopPropagation()}
      onTouchEnd={event => event.stopPropagation()}>Outside</div></>;
};

const armPull = (direction: 1 | -1) => {
  const container = screen.getByTestId('pull');
  const first = { identifier: 1, clientX: 100, clientY: 80 };
  const down = { ...first, clientY: 130 };
  const moved = { ...down, clientX: 100 + direction * 40 };
  fireEvent.touchStart(container, { touches: [first] });
  fireEvent.touchMove(container, { touches: [down] });
  fireEvent.touchMove(container, { touches: [moved] });
  return { container, moved };
};

describe('pull action qualification', () => {
  let previousStyle: string | null;
  let previousZoom: string | null;
  beforeEach(() => {
    previousStyle = document.documentElement.getAttribute('style');
    previousZoom = localStorage.getItem('app_zoom_level');
  });
  afterEach(() => {
    cleanup();
    if (previousStyle === null) document.documentElement.removeAttribute('style');
    else document.documentElement.setAttribute('style', previousStyle);
    if (previousZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousZoom);
  });

  it.each([1, -1] as const)('keeps the existing action and thresholds for direction %s', direction => {
    const search = vi.fn(), cloud = vi.fn();
    render(<PullHarness search={search} cloud={cloud} />);
    const { container, moved } = armPull(direction);
    expect(screen.getByText(direction === 1 ? 'search' : 'cloud')).toBeInTheDocument();
    fireEvent.touchEnd(container, { touches: [], changedTouches: [moved] });
    expect(direction === 1 ? search : cloud).toHaveBeenCalledOnce();
    expect(direction === 1 ? cloud : search).not.toHaveBeenCalled();
    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('does not trigger an armed action on touchcancel', () => {
    const search = vi.fn(), cloud = vi.fn();
    render(<PullHarness search={search} cloud={cloud} />);
    const { container, moved } = armPull(1);
    fireEvent.touchCancel(container, { touches: [], changedTouches: [moved] });
    expect(search).not.toHaveBeenCalled();
    expect(cloud).not.toHaveBeenCalled();
    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('rejects the remaining pinch finger, then permits a fresh pull without a cooldown', () => {
    const search = vi.fn(), cloud = vi.fn();
    render(<PullHarness search={search} cloud={cloud} />);
    const { container, moved } = armPull(-1);
    const outside = screen.getByTestId('outside');
    const second = { identifier: 2, clientX: 200, clientY: 130 };
    fireEvent.touchStart(outside, { touches: [moved, second] });
    fireEvent.touchEnd(outside, { touches: [moved], changedTouches: [second] });
    fireEvent.touchMove(container, { touches: [moved] });
    fireEvent.touchEnd(container, { touches: [], changedTouches: [moved] });
    expect(search).not.toHaveBeenCalled();
    expect(cloud).not.toHaveBeenCalled();
    expect(screen.getByText('neutral')).toBeInTheDocument();
    const fresh = armPull(1);
    fireEvent.touchEnd(container, { touches: [], changedTouches: [fresh.moved] });
    expect(search).toHaveBeenCalledOnce();
  });

  it('resets an armed action when disabled instead of replaying it when enabled', () => {
    const search = vi.fn(), cloud = vi.fn();
    const { rerender } = render(<PullHarness search={search} cloud={cloud} />);
    const { container, moved } = armPull(1);
    rerender(<PullHarness search={search} cloud={cloud} disabled />);
    expect(screen.getByText('neutral')).toBeInTheDocument();
    rerender(<PullHarness search={search} cloud={cloud} />);
    fireEvent.touchEnd(container, { touches: [], changedTouches: [moved] });
    expect(search).not.toHaveBeenCalled();
  });
});

import React, { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePullAction } from './usePullAction';

const PullActionHarness: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  usePullAction(containerRef, {
    onTriggerSearch: vi.fn(),
    onTriggerCloud: vi.fn()
  });

  return <div ref={containerRef} data-testid="dashboard-scroll-container" />;
};

describe('usePullAction horizontal gesture handling', () => {
  it('cancels the browser click after a horizontal gesture started at the top', () => {
    const { getByTestId } = render(<PullActionHarness />);
    const container = getByTestId('dashboard-scroll-container');
    const start = { clientX: 120, clientY: 80 };
    const move = { clientX: 60, clientY: 82 };

    fireEvent.touchStart(container, { touches: [start], targetTouches: [start] });
    const moveEvent = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(moveEvent, 'touches', { value: [move] });
    Object.defineProperty(moveEvent, 'targetTouches', { value: [move] });
    container.dispatchEvent(moveEvent);

    expect(moveEvent.defaultPrevented).toBe(true);
  });

  it('preserves native scrolling for a vertical-dominant diagonal gesture', () => {
    const { getByTestId } = render(<PullActionHarness />);
    const container = getByTestId('dashboard-scroll-container');
    const start = { clientX: 120, clientY: 80 };
    const move = { clientX: 100, clientY: 140 };

    fireEvent.touchStart(container, { touches: [start], targetTouches: [start] });
    const moveEvent = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(moveEvent, 'touches', { value: [move] });
    Object.defineProperty(moveEvent, 'targetTouches', { value: [move] });
    container.dispatchEvent(moveEvent);

    expect(moveEvent.defaultPrevented).toBe(false);
  });
});

import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebugGestures } from './useDebugGestures';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import type { DashboardMode } from '../dashboardMode';

const GestureHarness = ({ initialMode = 'library', inspect = vi.fn(), activate = vi.fn() }: {
    initialMode?: DashboardMode; inspect?: () => void; activate?: () => void;
}) => {
    useMobileZoom();
    const [viewMode, setViewMode] = useState(initialMode);
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: inspect });

    useEffect(() => {
        window.addEventListener('click', suppressInvalidTouchClick, true);
        return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
    }, []);

    return (
        <><div
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
            onTouchCancel={gestures.handleDebugTouchCancel}
        >
            <button key={viewMode} type="button" className="touch-pan-y" onClick={activate}>Game row</button>
            <output>{viewMode}</output>
        </div><div data-testid="outside" onTouchStart={event => event.stopPropagation()}
            onTouchEnd={event => event.stopPropagation()}>Outside</div></>
    );
};

const swipeOn = (button: HTMLElement, endEvent: 'touchEnd' | 'touchCancel' = 'touchEnd', direction = -1) => {
    const start = { identifier: 1, clientX: 120, clientY: 80 };
    const end = { ...start, clientX: start.clientX + direction * 60 };
    fireEvent.touchStart(button, { touches: [start], targetTouches: [start] });
    fireEvent.touchMove(button, { touches: [end], targetTouches: [end] });
    return fireEvent[endEvent](button, { touches: [], changedTouches: [end], cancelable: true });
};

describe('dashboard swipe from compact game rows', () => {
    let previousStyle: string | null;
    let previousZoom: string | null;
    beforeEach(() => {
        previousStyle = document.documentElement.getAttribute('style');
        previousZoom = localStorage.getItem('app_zoom_level');
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        if (previousStyle === null) document.documentElement.removeAttribute('style');
        else document.documentElement.setAttribute('style', previousStyle);
        if (previousZoom === null) localStorage.removeItem('app_zoom_level');
        else localStorage.setItem('app_zoom_level', previousZoom);
    });
    it.each(['library', 'history'] as const)('switches from %s without suppressing the next click-only activation', initialMode => {
        const activate = vi.fn();
        render(<GestureHarness initialMode={initialMode} activate={activate} />);
        const previousButton = screen.getByRole('button', { name: 'Game row' });

        // Cancel the swipe's own default click, rather than leaving a global
        // handled flag that requires the next tap to deliver a touchstart.
        expect(swipeOn(previousButton, 'touchEnd', initialMode === 'library' ? -1 : 1)).toBe(false);

        expect(screen.getByText(initialMode === 'library' ? 'history' : 'library')).toBeInTheDocument();
        expect(activate).not.toHaveBeenCalled();
        const nextButton = screen.getByRole('button', { name: 'Game row' });
        expect(nextButton).not.toBe(previousButton);
        fireEvent.click(nextButton); // No new touch stream or waiting period.
        expect(activate).toHaveBeenCalledTimes(1);
        fireEvent.click(nextButton);
        expect(activate).toHaveBeenCalledTimes(2);
    });

    it('cancels without changing views and accepts the next swipe immediately', () => {
        render(<GestureHarness />);

        swipeOn(screen.getByRole('button', { name: 'Game row' }), 'touchCancel');

        expect(screen.getByText('library')).toBeInTheDocument();
        swipeOn(screen.getByRole('button', { name: 'Game row' }));
        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('places settings before the library and preserves the existing left swipe to history', () => {
        render(<GestureHarness />);
        const row = () => screen.getByRole('button', { name: 'Game row' });
        swipeOn(row(), 'touchEnd', 1);
        expect(screen.getByText('settings')).toBeInTheDocument();
        swipeOn(row());
        expect(screen.getByText('library')).toBeInTheDocument();
        swipeOn(row());
        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('rejects a pinch whose second finger starts outside the swipe container', () => {
        const activate = vi.fn();
        render(<GestureHarness activate={activate} />);
        const button = screen.getByRole('button', { name: 'Game row' });
        const outside = screen.getByTestId('outside');
        const first = { identifier: 1, clientX: 120, clientY: 80 };
        const moved = { ...first, clientX: 60 };
        const second = { identifier: 2, clientX: 180, clientY: 80 };
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchMove(button, { touches: [moved] });
        fireEvent.touchStart(outside, { touches: [moved, second] });
        fireEvent.touchEnd(outside, { touches: [moved], changedTouches: [second] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [moved] });
        expect(screen.getByText('library')).toBeInTheDocument();
        fireEvent.click(button);
        expect(activate).not.toHaveBeenCalled();
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [first] });
        fireEvent.click(button);
        expect(activate).toHaveBeenCalledTimes(1);
        swipeOn(button);
        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('does not let a delayed debug hold survive an external pinch or unmount', () => {
        vi.useFakeTimers();
        const inspect = vi.fn();
        const { unmount } = render(<GestureHarness initialMode="history" inspect={inspect} />);
        const button = screen.getByRole('button', { name: 'Game row' });
        const outside = screen.getByTestId('outside');
        const first = { clientX: 200, clientY: 80 };
        const moved = { clientX: 60, clientY: 80 };
        const second = { clientX: 280, clientY: 80 };
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchMove(button, { touches: [moved] });
        fireEvent.touchStart(outside, { touches: [moved, second] });
        act(() => vi.advanceTimersByTime(3000));
        expect(inspect).not.toHaveBeenCalled();
        fireEvent.touchEnd(outside, { touches: [moved], changedTouches: [second] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [moved] });
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchMove(button, { touches: [moved] });
        unmount();
        act(() => vi.advanceTimersByTime(3000));
        expect(inspect).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

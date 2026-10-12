import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebugGestures } from './useDebugGestures';
import { useMobileZoom } from '../../../hooks/useMobileZoom';

const GestureHarness = ({ initialMode = 'library', inspect = vi.fn() }: {
    initialMode?: 'library' | 'history'; inspect?: () => void;
}) => {
    useMobileZoom();
    const [viewMode, setViewMode] = useState(initialMode);
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: inspect });

    return (
        <><div
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
            onTouchCancel={gestures.handleDebugTouchCancel}
        >
            <button type="button" className="touch-pan-y">Game row</button>
            <output>{viewMode}</output>
        </div><div data-testid="outside" onTouchStart={event => event.stopPropagation()}
            onTouchEnd={event => event.stopPropagation()}>Outside</div></>
    );
};

const swipeLeftOn = (button: HTMLElement, endEvent: 'touchEnd' | 'touchCancel' = 'touchEnd') => {
    const start = { clientX: 120, clientY: 80 };
    const end = { clientX: 60, clientY: 80 };
    fireEvent.touchStart(button, { touches: [start], targetTouches: [start] });
    fireEvent.touchMove(button, { touches: [end], targetTouches: [end] });
    fireEvent[endEvent](button, { changedTouches: [end] });
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
    it('switches to history when a left swipe starts on the row button', () => {
        render(<GestureHarness />);

        swipeLeftOn(screen.getByRole('button', { name: 'Game row' }));

        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('cancels without changing views and accepts the next swipe immediately', () => {
        render(<GestureHarness />);

        swipeLeftOn(screen.getByRole('button', { name: 'Game row' }), 'touchCancel');

        expect(screen.getByText('library')).toBeInTheDocument();
        swipeLeftOn(screen.getByRole('button', { name: 'Game row' }));
        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('rejects a pinch whose second finger starts outside the swipe container', () => {
        render(<GestureHarness />);
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
        swipeLeftOn(button);
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

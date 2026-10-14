import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebugGestures } from './useDebugGestures';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import { LanguageProvider } from '../../../i18n';
import HistoryCard from '../parts/HistoryCard';
import type { HistorySummary } from '../../../utils/extractDataSummaries';

const record: HistorySummary = {
    id: 'history-one', templateId: 'template-one', gameName: 'Game row', endTime: 1000,
    winnerIds: [], scoringRule: 'HIGHEST_WINS',
    players: [{ id: 'player-one', name: 'Player', color: '#123456', totalScore: 42 }],
    _playerNames: 'Player', _dateStr: '1970/01/01', _compactDate: '700101', _rocDate: '590101',
};

const GestureHarness = ({ initialMode = 'library', inspect = vi.fn(), activate = vi.fn(), remove = vi.fn() }: {
    initialMode?: 'library' | 'history'; inspect?: () => void; activate?: () => void; remove?: (id: string) => void;
}) => {
    useMobileZoom();
    const [viewMode, setViewMode] = useState(initialMode);
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: inspect });

    useEffect(() => {
        window.addEventListener('click', suppressInvalidTouchClick, true);
        return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
    }, []);

    return (
        <LanguageProvider><div
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
            onTouchCancel={gestures.handleDebugTouchCancel}
        >
            {viewMode === 'history' ? <HistoryCard record={record} onClick={activate} onDelete={remove} />
                : <button type="button" className="touch-pan-y" onClick={activate}>Game row</button>}
            <output>{viewMode}</output>
        </div><div data-testid="outside" onTouchStart={event => event.stopPropagation()}
            onTouchEnd={event => event.stopPropagation()}>Outside</div></LanguageProvider>
    );
};

const swipeOn = (button: HTMLElement, endEvent: 'touchEnd' | 'touchCancel' = 'touchEnd', direction = -1) => {
    const start = { identifier: 1, clientX: 120, clientY: 80 };
    const end = { ...start, clientX: start.clientX + direction * 60 };
    fireEvent.touchStart(button, { touches: [start], targetTouches: [start] });
    fireEvent.touchMove(button, { touches: [end], targetTouches: [end] });
    return fireEvent[endEvent](button, { touches: [], changedTouches: [end], cancelable: true });
};

const touchOnlyTap = (target: HTMLElement) => {
    const touch = { identifier: 3, target, clientX: 100, clientY: 100 };
    fireEvent.touchStart(target, { touches: [touch], changedTouches: [touch] });
    fireEvent.touchEnd(target, { touches: [], changedTouches: [touch] });
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
        const previousButton = screen.getByText('Game row');

        // Cancel the swipe's own default click, rather than leaving a global
        // handled flag that requires the next tap to deliver a touchstart.
        expect(swipeOn(previousButton, 'touchEnd', initialMode === 'library' ? -1 : 1)).toBe(false);

        expect(screen.getByText(initialMode === 'library' ? 'history' : 'library')).toBeInTheDocument();
        expect(activate).not.toHaveBeenCalled();
        const nextButton = screen.getByText('Game row');
        expect(nextButton).not.toBe(previousButton);
        fireEvent.click(nextButton); // No new touch stream or waiting period.
        expect(activate).toHaveBeenCalledTimes(1);
        fireEvent.click(nextButton);
        expect(activate).toHaveBeenCalledTimes(2);
    });

    it('opens the real history card on the first touch without a compatibility click after switching views', () => {
        const activate = vi.fn();
        render(<GestureHarness activate={activate} />);
        swipeOn(screen.getByText('Game row'));
        const cardTitle = screen.getByText('Game row');

        touchOnlyTap(cardTitle);
        expect(activate).toHaveBeenCalledTimes(1);
        fireEvent.click(cardTitle);
        expect(activate).toHaveBeenCalledTimes(1);
        touchOnlyTap(cardTitle);
        expect(activate).toHaveBeenCalledTimes(2);
    });

    it('deletes by touch without waiting for a click or opening the history card', () => {
        const activate = vi.fn();
        const remove = vi.fn();
        render(<GestureHarness activate={activate} remove={remove} />);
        swipeOn(screen.getByText('Game row'));
        const button = screen.getByRole('button');

        touchOnlyTap(button);
        expect(remove).toHaveBeenCalledExactlyOnceWith(record.id);
        fireEvent.click(button);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(activate).not.toHaveBeenCalled();
    });

    it.each([
        { dx: 11, dy: 0, mode: 'library', targetKind: 'title' },
        { dx: 0, dy: 11, mode: 'history', targetKind: 'title' },
        { dx: 11, dy: 0, mode: 'library', targetKind: 'delete' },
    ])(
        'does not activate $targetKind during a short swipe or scroll ($dx, $dy)', ({ dx, dy, mode, targetKind }) => {
            vi.useFakeTimers();
            vi.setSystemTime(1000);
            const activate = vi.fn();
            const remove = vi.fn();
            render(<GestureHarness initialMode="history" activate={activate} remove={remove} />);
            const target = targetKind === 'delete' ? screen.getByRole('button') : screen.getByText('Game row');
            const start = { identifier: 1, target, clientX: 100, clientY: 100 };
            const end = { ...start, clientX: start.clientX + dx, clientY: start.clientY + dy };
            fireEvent.touchStart(target, { touches: [start], changedTouches: [start] });
            act(() => vi.advanceTimersByTime(10));
            fireEvent.touchMove(target, { touches: [end], changedTouches: [end] });
            fireEvent.touchEnd(target, { touches: [], changedTouches: [end] });
            expect(activate).not.toHaveBeenCalled();
            expect(remove).not.toHaveBeenCalled();
            expect(screen.getByText(mode)).toBeInTheDocument();
        },
    );

    it('cancels without changing views and accepts the next swipe immediately', () => {
        render(<GestureHarness />);

        swipeOn(screen.getByText('Game row'), 'touchCancel');

        expect(screen.getByText('library')).toBeInTheDocument();
        swipeOn(screen.getByText('Game row'));
        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it.each(['library', 'history'] as const)('rejects a pinch whose second finger starts outside the %s container', initialMode => {
        const activate = vi.fn();
        render(<GestureHarness initialMode={initialMode} activate={activate} />);
        const button = screen.getByText('Game row');
        const outside = screen.getByTestId('outside');
        const first = { identifier: 1, clientX: 120, clientY: 80 };
        const moved = { ...first, clientX: 60 };
        const second = { identifier: 2, clientX: 180, clientY: 80 };
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchMove(button, { touches: [moved] });
        fireEvent.touchStart(outside, { touches: [moved, second] });
        fireEvent.touchEnd(outside, { touches: [moved], changedTouches: [second] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [moved] });
        expect(screen.getByText(initialMode)).toBeInTheDocument();
        fireEvent.click(button);
        expect(activate).not.toHaveBeenCalled();
        fireEvent.touchStart(button, { touches: [first] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [first] });
        fireEvent.click(button);
        expect(activate).toHaveBeenCalledTimes(1);
        swipeOn(button, 'touchEnd', initialMode === 'library' ? -1 : 1);
        expect(screen.getByText(initialMode === 'library' ? 'history' : 'library')).toBeInTheDocument();
    });

    it('does not let a delayed debug hold survive an external pinch or unmount', () => {
        vi.useFakeTimers();
        const inspect = vi.fn();
        const { unmount } = render(<GestureHarness initialMode="history" inspect={inspect} />);
        const button = screen.getByText('Game row');
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

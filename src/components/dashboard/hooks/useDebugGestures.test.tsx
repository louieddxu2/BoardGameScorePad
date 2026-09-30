import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDebugGestures } from './useDebugGestures';

const GestureHarness: React.FC = () => {
    const [viewMode, setViewMode] = useState<'library' | 'history'>('library');
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: vi.fn() });

    return (
        <div
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
            onTouchCancel={gestures.handleDebugTouchEnd}
        >
            <button type="button" className="touch-pan-y">Game row</button>
            <output>{viewMode}</output>
        </div>
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
    it('switches to history when a left swipe starts on the row button', () => {
        render(<GestureHarness />);

        swipeLeftOn(screen.getByRole('button', { name: 'Game row' }));

        expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('finishes the swipe when the browser cancels the touch sequence', () => {
        render(<GestureHarness />);

        swipeLeftOn(screen.getByRole('button', { name: 'Game row' }), 'touchCancel');

        expect(screen.getByText('history')).toBeInTheDocument();
    });
});

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { LanguageProvider } from '../../../i18n';
import { ToastProvider } from '../../../hooks/useToast';
import type { OverlayData } from './ScoreOverlayGenerator';
import PhotoLightbox from './PhotoLightbox';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
});

const images = Array.from({ length: 5 }, (_, i) => ({ id: `photo-${i}`, url: `blob:photo-${i}` }));
const width = 360;
const finger = (offset = 0) => ({ identifier: 1, clientX: 180 + offset, clientY: 100 });
const start = (viewport: HTMLElement) => fireEvent.touchStart(viewport, { touches: [finger()] });
const move = (viewport: HTMLElement, offset: number) => fireEvent.touchMove(viewport, { touches: [finger(offset)] });
const end = (viewport: HTMLElement) => fireEvent.touchEnd(viewport, { touches: [] });
const preview = (viewport: HTMLElement, side: string) => viewport.querySelector<HTMLDivElement>(`[data-photo-preview="${side}"]`);
const position = (side: string, offset = 0) => `translateX(${side === 'previous' ? '-100%' : '100%'}) translateX(${offset}px)`;
const renderViewer = (initialIndex = 2, overlayData?: OverlayData) => {
    const { container } = render(<LanguageProvider><ToastProvider><PhotoLightbox
        images={images} initialIndex={initialIndex} onClose={vi.fn()} onDelete={vi.fn()}
        manageBackHistory={false} overlayData={overlayData} initialShowOverlay={!!overlayData} />
    </ToastProvider></LanguageProvider>);
    const viewport = container.querySelector<HTMLDivElement>('[data-mobile-zoom-ignore="true"]')!;
    // JSDOM has no layout; supply only the width sampled at gesture start.
    Object.defineProperty(viewport, 'clientWidth', { value: width, configurable: true });
    return viewport;
};

describe('photo swipe preview', () => {
    it.each([
        { side: 'previous', other: 'next', sign: 1, target: 1 },
        { side: 'next', other: 'previous', sign: -1, target: 3 },
    ])('reveals part of the full-size $side photo and commits the latest move on release', ({ side, other, sign, target }) => {
        const viewport = renderViewer();
        const current = screen.getByAltText('Full view');
        expect(preview(viewport, side)!.style.transform).toBe(position(side));
        expect(preview(viewport, other)!.style.transform).toBe(position(other));
        start(viewport);
        move(viewport, sign * 40);
        expect(current).toHaveAttribute('src', images[2].url);
        expect(current.parentElement!.style.transform).toBe(`translateX(${sign * 40}px)`);
        expect(preview(viewport, side)!.style.transform).toBe(position(side, sign * 40));
        // Preview and viewer use the same contain sizing, including small photos.
        expect(preview(viewport, side)!.querySelector('img')!.className).toBe(current.className);
        expect(preview(viewport, side)!.querySelector('img')).toHaveAttribute('src', images[target].url);
        expect(preview(viewport, side)).toHaveAttribute('aria-hidden', 'true');
        expect(preview(viewport, other)!.style.transform).toBe(position(other, sign * 40));
        expect(viewport.querySelectorAll('img')).toHaveLength(3); // Not the entire album.
        move(viewport, sign * 70);
        expect(preview(viewport, side)!.style.transform).toBe(position(side, sign * 70));
        move(viewport, sign * 80);
        expect(preview(viewport, side)!.style.transform).toBe(position(side, sign * 80));
        expect(preview(viewport, side)!.style.transform).not.toContain('scale(');
        // A fast final move/release can be batched before the new offset renders.
        act(() => { move(viewport, sign * 100); end(viewport); });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[target].url);
        expect(screen.getByText(`${target + 1} / 5`)).toBeInTheDocument();
        expect(preview(viewport, side)!.style.transform).toBe(position(side));
    });

    it('returns at the existing threshold and cancels a reversed swipe without changing photos', () => {
        const viewport = renderViewer();
        start(viewport);
        move(viewport, -80);
        end(viewport);
        const current = screen.getByAltText('Full view');
        expect(current).toHaveAttribute('src', images[2].url);
        expect(current.parentElement!.style.transform).toBe('translateX(0px)');
        expect(current.parentElement).toHaveClass('motion-reduce:transition-none');
        expect(preview(viewport, 'next')!.style.transform).toBe(position('next'));

        start(viewport);
        move(viewport, -120);
        move(viewport, 100);
        expect(preview(viewport, 'next')!.style.transform).toBe(position('next', 100));
        expect(preview(viewport, 'previous')!.style.transform).toBe(position('previous', 100));
        fireEvent.touchCancel(viewport, { touches: [] });
        end(viewport);
        expect(current).toHaveAttribute('src', images[2].url);
        expect(current.parentElement!.style.transform).toBe('translateX(0px)');
        expect(preview(viewport, 'previous')!.style.transform).toBe(position('previous'));
    });

    it.each([
        { initialIndex: 0, offset: 1000, missing: 'previous', available: 'next' },
        { initialIndex: 4, offset: -1000, missing: 'next', available: 'previous' },
    ])('does not preview or wrap past the $missing album boundary', ({ initialIndex, offset, missing, available }) => {
        const viewport = renderViewer(initialIndex);
        fireEvent.mouseDown(viewport, { clientX: 180, clientY: 100 });
        fireEvent.mouseMove(viewport, { clientX: 180 + offset, clientY: 100 });
        expect(preview(viewport, missing)).toBeNull();
        expect(preview(viewport, available)!.style.transform).toBe(position(available, Math.sign(offset) * width));
        expect(screen.getByAltText('Full view').parentElement!.style.transform).toBe(`translateX(${Math.sign(offset) * width}px)`);
        fireEvent.mouseUp(viewport);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[initialIndex].url);
    });

    it('cancels a pending swipe on pinch and keeps zoomed dragging separate from photo navigation', () => {
        const viewport = renderViewer();
        start(viewport);
        move(viewport, -100);
        const first = finger(-100);
        const second = { identifier: 2, clientX: 180, clientY: 100 };
        fireEvent.touchStart(viewport, { touches: [first, second] });
        fireEvent.touchMove(viewport, { touches: [first, second] }); // Scale stays 1, not a zoom-based veto.
        expect(preview(viewport, 'next')!.style.transform).toBe(position('next'));
        fireEvent.touchEnd(viewport, { touches: [first] });
        move(viewport, -200);
        end(viewport);
        const current = screen.getByAltText('Full view');
        expect(current).toHaveAttribute('src', images[2].url);

        fireEvent.wheel(viewport, { deltaY: -1000 });
        start(viewport);
        move(viewport, -100);
        end(viewport);
        expect(current.style.transform).toBe('translate(-100px, 0px) scale(2)');
        expect(current).toHaveAttribute('src', images[2].url);
        expect(preview(viewport, 'next')!.style.transform).toBe(position('next'));
        fireEvent.click(screen.getByTitle('Reset View'));
        start(viewport);
        move(viewport, -100);
        end(viewport);
        expect(current).toHaveAttribute('src', images[3].url);
    });

    it('previews original neighbours without regenerating the current score composite during a drag', async () => {
        vi.useFakeTimers();
        let urlCount = 0;
        vi.stubGlobal('URL', class extends URL {
            static createObjectURL = vi.fn(() => `blob:composed-${++urlCount}`);
            static revokeObjectURL = vi.fn();
        });
        vi.mocked(toBlob).mockImplementation(async node => new Blob([node.querySelector('img')!.src]));
        const overlayData: OverlayData = {
            gameName: 'Game', date: 1, players: [{ id: 'p', name: 'Player', color: '#fff', scores: {}, totalScore: 1 }], winners: [],
        };
        const viewport = renderViewer(2, overlayData);
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', 'blob:composed-1');
        expect(preview(viewport, 'next')!.querySelector('img')).toHaveAttribute('src', images[3].url);
        start(viewport);
        move(viewport, -40);
        await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
        end(viewport);
        expect(toBlob).toHaveBeenCalledTimes(1);
        start(viewport);
        move(viewport, -100);
        end(viewport);
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(toBlob).toHaveBeenCalledTimes(2);
        expect(vi.mocked(toBlob).mock.calls[1][0].querySelector('img')).toHaveAttribute('src', images[3].url);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', 'blob:composed-2');
    });
});

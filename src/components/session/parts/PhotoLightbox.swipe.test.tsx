import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { LanguageProvider } from '../../../i18n';
import { ToastProvider } from '../../../hooks/useToast';
import type { OverlayData } from './ScoreOverlayGenerator';
import PhotoLightbox from './PhotoLightbox';
import { PHOTO_PAGE_GAP, PHOTO_SLIDE_DURATION } from '../../../utils/photoViewerGeometry';
import * as modalHistory from '../../../hooks/useModalBackHandler';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
const track = (viewport: HTMLElement) => viewport.querySelector<HTMLDivElement>('[data-photo-track="true"]')!;
const finish = (viewport: HTMLElement) => {
    act(() => vi.advanceTimersByTime(PHOTO_SLIDE_DURATION));
    fireEvent.transitionEnd(track(viewport), { propertyName: 'transform' });
};
const position = (side: string) => `translateX(${side === 'previous' ? '-100%' : '100%'}) translateX(${side === 'previous' ? -PHOTO_PAGE_GAP : PHOTO_PAGE_GAP}px)`;
const renderViewer = (initialIndex = 2, overlayData?: OverlayData, onCurrentPhotoChange = vi.fn()) => {
    const { container } = render(<LanguageProvider><ToastProvider><PhotoLightbox
        images={images} initialIndex={initialIndex} onClose={vi.fn()} onDelete={vi.fn()}
        manageBackHistory={false} overlayData={overlayData} initialShowOverlay={!!overlayData}
        onCurrentPhotoChange={onCurrentPhotoChange} />
    </ToastProvider></LanguageProvider>);
    const viewport = container.querySelector<HTMLDivElement>('[data-mobile-zoom-ignore="true"]')!;
    // JSDOM has no layout; supply the viewport sampled at gesture start.
    Object.defineProperty(viewport, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 640, configurable: true });
    return viewport;
};

describe('photo swipe preview', () => {
    it.each([
        { side: 'previous', other: 'next', sign: 1, target: 1 },
        { side: 'next', other: 'previous', sign: -1, target: 3 },
    ])('slides the full-size $side photo across a theme-aware gap and keeps its DOM node on arrival', ({ side, other, sign, target }) => {
        const viewport = renderViewer();
        const current = screen.getByAltText('Full view');
        const arriving = preview(viewport, side)!.querySelector('img');
        expect(viewport).toHaveClass('bg-app-bg-deep');
        expect(viewport).not.toHaveClass('bg-black');
        expect(preview(viewport, side)!.style.transform).toBe(position(side));
        expect(preview(viewport, other)!.style.transform).toBe(position(other));
        start(viewport);
        move(viewport, sign * 40);
        expect(current).toHaveAttribute('src', images[2].url);
        expect(track(viewport).style.transform).toBe(`translateX(${sign * 40}px)`);
        expect(preview(viewport, side)!.style.transform).toBe(position(side));
        // Preview and viewer use the same contain sizing, including small photos.
        expect(preview(viewport, side)!.querySelector('img')!.className).toBe(current.className);
        expect(preview(viewport, side)!.querySelector('img')).toHaveAttribute('src', images[target].url);
        expect(preview(viewport, side)).toHaveAttribute('aria-hidden', 'true');
        expect(preview(viewport, other)!.style.transform).toBe(position(other));
        expect(viewport.querySelectorAll('img')).toHaveLength(3); // Not the entire album.
        move(viewport, sign * 70);
        expect(track(viewport).style.transform).toBe(`translateX(${sign * 70}px)`);
        move(viewport, sign * 80);
        expect(track(viewport).style.transform).toBe(`translateX(${sign * 80}px)`);
        expect(preview(viewport, side)!.style.transform).not.toContain('scale(');
        // A fast final move/release can be batched before the new offset renders.
        act(() => { move(viewport, sign * 100); end(viewport); });
        expect(current).toHaveAttribute('src', images[2].url); // Do not swap the photo mid-animation.
        expect(track(viewport).style.transform).toBe(`translateX(${sign * (width + PHOTO_PAGE_GAP)}px)`);
        expect(track(viewport)).toHaveClass('transition-transform');
        expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
        finish(viewport);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[target].url);
        expect(screen.getByAltText('Full view')).toBe(arriving);
        expect(screen.getByText(`${target + 1} / 5`)).toBeInTheDocument();
        expect(preview(viewport, side)!.style.transform).toBe(position(side));
        expect(track(viewport).style.transform).toBe('translateX(0px)');
        expect(track(viewport)).toHaveClass('transition-none'); // Rebase without a second animation.
    });

    it('returns at the existing threshold and cancels a reversed swipe without changing photos', () => {
        const viewport = renderViewer();
        start(viewport);
        move(viewport, -80);
        end(viewport);
        const current = screen.getByAltText('Full view');
        expect(current).toHaveAttribute('src', images[2].url);
        expect(track(viewport).style.transform).toBe('translateX(0px)');
        expect(track(viewport)).toHaveClass('motion-reduce:transition-none');
        finish(viewport);
        expect(preview(viewport, 'next')!.style.transform).toBe(position('next'));

        start(viewport);
        move(viewport, -120);
        move(viewport, 100);
        expect(track(viewport).style.transform).toBe('translateX(100px)');
        fireEvent.touchCancel(viewport, { touches: [] });
        end(viewport);
        finish(viewport);
        expect(current).toHaveAttribute('src', images[2].url);
        expect(track(viewport).style.transform).toBe('translateX(0px)');
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
        expect(preview(viewport, available)!.style.transform).toBe(position(available));
        const dragged = Number(track(viewport).style.transform.match(/translateX\((.+)px\)/)![1]);
        expect(Math.sign(dragged)).toBe(Math.sign(offset));
        expect(Math.abs(dragged)).toBeLessThan(width * 0.3); // Elastic edge, not a blank page.
        fireEvent.mouseUp(viewport);
        finish(viewport);
        expect(track(viewport).style.transform).toBe('translateX(0px)');
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

        fireEvent.wheel(viewport, { deltaY: -1000, clientX: 180, clientY: 320 });
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
        finish(viewport);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[3].url);
    });

    it('previews original neighbours without regenerating the current score composite during a drag', async () => {
        vi.useFakeTimers();
        // Blob images do not load in JSDOM; this case starts with a ready export source.
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1080);
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
        finish(viewport);
        expect(toBlob).toHaveBeenCalledTimes(1);
        start(viewport);
        move(viewport, -100);
        end(viewport);
        finish(viewport);
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(toBlob).toHaveBeenCalledTimes(2);
        expect(vi.mocked(toBlob).mock.calls[1][0].querySelector('img')).toHaveAttribute('src', images[3].url);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', 'blob:composed-2');
    });

    it('locks the gesture direction and supports keyboard navigation without adding history', () => {
        const history = vi.spyOn(window.history, 'pushState');
        const viewport = renderViewer();
        start(viewport);
        fireEvent.touchMove(viewport, { touches: [{ ...finger(10), clientY: 220 }] });
        fireEvent.touchMove(viewport, { touches: [{ ...finger(-200), clientY: 230 }] });
        end(viewport);
        expect(track(viewport).style.transform).toBe('translateX(0px)');
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveFocus();
        fireEvent.keyDown(dialog, { key: 'ArrowRight', ctrlKey: true });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
        fireEvent.keyDown(dialog, { key: 'ArrowRight' });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[3].url);
        fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
        expect(history).not.toHaveBeenCalled();
        // A confirmation above the lightbox must own input, even if focus lags.
        vi.spyOn(modalHistory, 'getTopModalId').mockReturnValue('global-confirm');
        fireEvent.keyDown(dialog, { key: 'ArrowRight' });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
    });

    it('anchors pinch zoom at the moving midpoint and clamps panning to the fitted image', () => {
        const viewport = renderViewer();
        const current = screen.getByAltText('Full view');
        Object.defineProperties(current, {
            naturalWidth: { value: 3600, configurable: true },
            naturalHeight: { value: 6400, configurable: true },
        });
        vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 40 } as DOMRect);
        const first = { identifier: 1, clientX: 220, clientY: 360 };
        const second = { identifier: 2, clientX: 280, clientY: 360 };
        fireEvent.touchStart(viewport, { touches: [first, second] });
        fireEvent.touchMove(viewport, { touches: [first, { ...second, clientX: 340 }] });
        expect(current.style.transform).toBe('translate(-20px, 0px) scale(2)');
        end(viewport);
        start(viewport);
        fireEvent.touchMove(viewport, { touches: [{ ...finger(-1000), clientY: 2100 }] });
        end(viewport);
        expect(current.style.transform).toBe('translate(-180px, 320px) scale(2)');
        expect(current).toHaveAttribute('src', images[2].url);
        fireEvent.click(screen.getByTitle('Reset View'));
        // A narrow portrait does not acquire horizontal blank space when zoomed.
        Object.defineProperties(current, { naturalWidth: { value: 400 }, naturalHeight: { value: 1600 } });
        fireEvent.wheel(viewport, { deltaY: -1000, clientX: 200, clientY: 360 });
        start(viewport);
        fireEvent.touchMove(viewport, { touches: [{ ...finger(1000), clientY: -1900 }] });
        end(viewport);
        expect(current.style.transform).toBe('translate(0px, -320px) scale(2)');
    });

    it('settles once if transitionend is missing and clears the fallback when unmounted', () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        const viewport = renderViewer(2, undefined, onChange);
        start(viewport);
        move(viewport, -100);
        end(viewport);
        fireEvent.transitionEnd(preview(viewport, 'next')!.querySelector('img')!, { propertyName: 'transform' });
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
        act(() => vi.advanceTimersByTime(PHOTO_SLIDE_DURATION + 50));
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[3].url);
        finish(viewport); // A late event cannot navigate again.
        expect(onChange.mock.calls.map(call => call[0])).toEqual(['photo-2', 'photo-3']);
        start(viewport);
        move(viewport, -100);
        end(viewport);
        fireEvent.transitionEnd(track(viewport), { propertyName: 'transform' }); // Old event, new animation.
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[3].url);
        fireEvent.click(screen.getByTitle('Reset View'));
        start(viewport);
        move(viewport, -100);
        end(viewport);
        expect(vi.getTimerCount()).toBe(1);
        cleanup();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('skips the settling delay for reduced motion and accepts the next fresh gesture', () => {
        vi.useFakeTimers();
        vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
        const viewport = renderViewer();
        const timeout = vi.spyOn(globalThis, 'setTimeout');
        start(viewport);
        move(viewport, -100);
        end(viewport);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[3].url);
        start(viewport);
        move(viewport, 100);
        end(viewport);
        expect(screen.getByAltText('Full view')).toHaveAttribute('src', images[2].url);
        expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), PHOTO_SLIDE_DURATION + 50);
    });
});

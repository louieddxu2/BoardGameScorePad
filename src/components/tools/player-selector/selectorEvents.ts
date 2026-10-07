import type { MutableRefObject } from 'react';
import type { SelectorPointerInput } from './selectorEngineTypes';
import type { PlayerSelectorPhysicsOptions } from './selectorRendererTypes';

interface PlayerSelectorEventOptions extends Pick<PlayerSelectorPhysicsOptions,
    'svgRef' | 'activeTouchesRef' | 'playersRef' | 'resultDisplayRef' |
    'isRunningRef' | 'animationFrameIdRef' | 'callbacksRef'
> {
    expectedCountRef: MutableRefObject<number>;
    physicsLoop: () => void;
    checkColorPaletteClick: (x: number, y: number) => boolean;
    checkPlayerClick: (x: number, y: number) => boolean;
    handleStart: (input: SelectorPointerInput) => void;
    handleMove: (input: SelectorPointerInput) => void;
    handleEnd: (id: string | number) => void;
    getTouchInput: (touch: Touch) => SelectorPointerInput;
    getPointerInput: (event: PointerEvent) => SelectorPointerInput;
    clearRendererState: () => void;
}
/** Install exactly one native input path and animation loop per mounted renderer. */
export function bindPlayerSelectorEvents({
    svgRef, activeTouchesRef, playersRef, resultDisplayRef, isRunningRef, animationFrameIdRef, callbacksRef,
    expectedCountRef, physicsLoop, checkColorPaletteClick, checkPlayerClick, handleStart, handleMove, handleEnd,
    getTouchInput, getPointerInput, clearRendererState
}: PlayerSelectorEventOptions) {
    const svg = svgRef.current;
    if (!svg) return;

    isRunningRef.current = true;
    animationFrameIdRef.current = requestAnimationFrame(physicsLoop);

    const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        if (resultDisplayRef.current.isInteractionLocked) return;
        for (const t of Array.from(e.changedTouches)) {
            if (checkColorPaletteClick(t.clientX, t.clientY)) continue;
            if (checkPlayerClick(t.clientX, t.clientY)) continue;
            if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) continue;

            // 限制人數，大於等於預期人數時阻止新氣泡生成
            const expected = expectedCountRef.current;
            if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
                continue;
            }

            handleStart(getTouchInput(t));
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        for (const t of Array.from(e.changedTouches)) {
            handleMove(getTouchInput(t));
        }
    };

    const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (const t of Array.from(e.changedTouches)) {
            handleEnd(t.identifier);
        }
    };

    const onTouchCancel = (e: TouchEvent) => {
        e.preventDefault();
        for (const t of Array.from(e.changedTouches)) {
            handleEnd(t.identifier);
        }
    };

    const onPointerDown = (e: PointerEvent) => {
        e.preventDefault();
        if (resultDisplayRef.current.isInteractionLocked) return;
        if (checkColorPaletteClick(e.clientX, e.clientY)) return;
        if (checkPlayerClick(e.clientX, e.clientY)) return;
        if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) return;

        // 限制人數，大於等於預期人數時阻止新氣泡生成
        const expected = expectedCountRef.current;
        if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
            return;
        }

        if (typeof svg.setPointerCapture === 'function') {
            try {
                svg.setPointerCapture(e.pointerId);
            } catch {
                // Pointer capture can fail if the browser cancels the pointer immediately.
            }
        }

        handleStart(getPointerInput(e));
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!activeTouchesRef.current.has(e.pointerId)) return;
        e.preventDefault();
        handleMove(getPointerInput(e));
    };

    const onPointerEnd = (e: PointerEvent) => {
        e.preventDefault();
        if (typeof svg.releasePointerCapture === 'function') {
            try {
                svg.releasePointerCapture(e.pointerId);
            } catch {
                // Pointer capture may already have been released by the browser.
            }
        }
        handleEnd(e.pointerId);
    };

    const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';

    let mouseIsDown = false;
    const MOUSE_ID = 'mouse';

    const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        if (resultDisplayRef.current.isInteractionLocked) return;
        if (checkColorPaletteClick(e.clientX, e.clientY)) return;
        if (checkPlayerClick(e.clientX, e.clientY)) return;
        if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) return;

        // 限制人數，大於等於預期人數時阻止新氣泡生成
        const expected = expectedCountRef.current;
        if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
            return;
        }

        mouseIsDown = true;
        handleStart({
            id: MOUSE_ID,
            clientX: e.clientX,
            clientY: e.clientY,
            contactWidth: 0,
            contactHeight: 0,
            contactAngle: 0,
            source: 'mouse'
        });
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!mouseIsDown) return;
        e.preventDefault();
        const t = activeTouchesRef.current.get(MOUSE_ID);
        if (t) {
            handleMove({
                id: MOUSE_ID,
                clientX: e.clientX,
                clientY: e.clientY,
                contactWidth: 0,
                contactHeight: 0,
                contactAngle: 0,
                source: 'mouse'
            });
        }
    };

    const onMouseUp = (_event: MouseEvent) => {
        if (!mouseIsDown) return;
        mouseIsDown = false;
        handleEnd(MOUSE_ID);
    };

    if (supportsPointerEvents) {
        svg.addEventListener("pointerdown", onPointerDown);
        svg.addEventListener("pointermove", onPointerMove);
        svg.addEventListener("pointerup", onPointerEnd);
        svg.addEventListener("pointercancel", onPointerEnd);
    } else {
        svg.addEventListener("touchstart", onTouchStart, { passive: false });
        svg.addEventListener("touchmove", onTouchMove, { passive: false });
        svg.addEventListener("touchend", onTouchEnd, { passive: false });
        svg.addEventListener("touchcancel", onTouchCancel, { passive: false });
        svg.addEventListener("mousedown", onMouseDown);
        svg.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
        isRunningRef.current = false;
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        if (supportsPointerEvents) {
            svg.removeEventListener("pointerdown", onPointerDown);
            svg.removeEventListener("pointermove", onPointerMove);
            svg.removeEventListener("pointerup", onPointerEnd);
            svg.removeEventListener("pointercancel", onPointerEnd);
        } else {
            svg.removeEventListener("touchstart", onTouchStart);
            svg.removeEventListener("touchmove", onTouchMove);
            svg.removeEventListener("touchend", onTouchEnd);
            svg.removeEventListener("touchcancel", onTouchCancel);
            svg.removeEventListener("mousedown", onMouseDown);
            svg.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }
        clearRendererState();
        svg.innerHTML = "";
        callbacksRef.current.onSelectorPlayersChange([]);
    };
}

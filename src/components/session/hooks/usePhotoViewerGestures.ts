import { useEffect, useRef, useState, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';
import { getTouchDistance } from '../../../utils/ui';
import {
    PHOTO_BASE_TRANSFORM, PHOTO_PAGE_GAP, PHOTO_SLIDE_DURATION, PHOTO_SWIPE_THRESHOLD,
    clampPhotoTransform, localPhotoPoint, measurePhotoViewport, photoSwipeOffset, zoomPhotoAtPoint,
    type PhotoMetrics, type PhotoPoint,
} from '../../../utils/photoViewerGeometry';

interface PhotoViewerGesturesOptions {
    currentId: string;
    imageKey: string;
    previousId?: string;
    nextId?: string;
    busy: boolean;
    onNavigate: (id: string) => void;
    onInteract: () => void;
}

type PointerEvent = MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>;
type Gesture = 'idle' | 'pending' | 'horizontal' | 'vertical' | 'pan' | 'pinch' | 'blocked';
const RESTING_MOTION = { offset: 0, settling: false };
const EMPTY_METRICS: PhotoMetrics = { width: 0, height: 0, left: 0, top: 0, imageWidth: 0, imageHeight: 0 };
const stopEvent = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
};
const pointerPoint = (event: PointerEvent): PhotoPoint => 'touches' in event
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
    : { x: event.clientX, y: event.clientY };

/** Own only photo gestures and their finite settling animation, not modal history. */
export const usePhotoViewerGestures = (options: PhotoViewerGesturesOptions) => {
    const latest = useRef(options);
    latest.current = options;
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState(PHOTO_BASE_TRANSFORM);
    const transformRef = useRef(transform);
    const [motion, setMotion] = useState(RESTING_MOTION);
    const motionRef = useRef(motion);
    const metrics = useRef(EMPTY_METRICS);
    const gesture = useRef<Gesture>('idle');
    const origin = useRef({ x: 0, y: 0 });
    const lastPoint = useRef(origin.current);
    const rawOffset = useRef(0);
    const pinch = useRef({ distance: 0, transform: PHOTO_BASE_TRANSFORM, anchor: origin.current });
    const pending = useRef<{ fromId: string; imageKey: string; targetId?: string; startedAt: number } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const updateTransform = (value: typeof transform) => {
        transformRef.current = value;
        setTransform(value);
    };
    const updateMotion = (value: typeof motion) => {
        motionRef.current = value;
        setMotion(value);
    };
    const clearTimer = () => {
        clearTimeout(timer.current);
        timer.current = undefined;
    };
    const resetView = () => {
        clearTimer();
        pending.current = null;
        gesture.current = 'idle';
        rawOffset.current = 0;
        updateMotion(RESTING_MOTION);
        updateTransform(PHOTO_BASE_TRANSFORM);
    };
    const finishSlide = (fromTransition = false) => {
        const destination = pending.current;
        if (!destination) return;
        // A delayed event from the previous slide cannot finish a fresh slide early.
        if (fromTransition && Date.now() - destination.startedAt < PHOTO_SLIDE_DURATION) return;
        resetView();
        const { currentId, imageKey, previousId, nextId, busy, onNavigate } = latest.current;
        if (!busy && currentId === destination.fromId && imageKey === destination.imageKey && destination.targetId
            && [previousId, nextId].includes(destination.targetId)) onNavigate(destination.targetId);
    };

    useEffect(() => {
        resetView();
        return clearTimer;
    }, [options.currentId, options.imageKey]);

    useEffect(() => {
        if (!options.busy) return;
        clearTimer();
        pending.current = null;
        gesture.current = 'idle';
        rawOffset.current = 0;
        updateMotion(RESTING_MOTION);
        // Loading/rotation may fail: preserve the existing zoom unless bytes change.
    }, [options.busy]);

    const settle = (direction: -1 | 0 | 1) => {
        const targetId = direction < 0 ? latest.current.previousId : direction > 0 ? latest.current.nextId : undefined;
        const offset = targetId ? -direction * (metrics.current.width + PHOTO_PAGE_GAP) : 0;
        pending.current = {
            fromId: latest.current.currentId, imageKey: latest.current.imageKey, targetId, startedAt: Date.now(),
        };
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
            || Math.abs(offset - motionRef.current.offset) < 0.5) {
            finishSlide();
            return;
        }
        updateMotion({ offset, settling: true });
        // A one-shot fallback covers missing transitionend (e.g. a hidden tab).
        timer.current = setTimeout(finishSlide, PHOTO_SLIDE_DURATION + 50);
    };
    const touchMidpoint = (event: TouchEvent<HTMLDivElement>) => localPhotoPoint(
        (event.touches[0].clientX + event.touches[1].clientX) / 2,
        (event.touches[0].clientY + event.touches[1].clientY) / 2,
        metrics.current,
    );

    const handlePointerDown = (event: PointerEvent) => {
        stopEvent(event);
        if (latest.current.busy || pending.current || ('button' in event && event.button !== 0)) return;
        latest.current.onInteract();
        metrics.current = measurePhotoViewport(containerRef.current);
        if ('touches' in event && event.touches.length >= 2) {
            gesture.current = 'pinch';
            rawOffset.current = 0;
            updateMotion(RESTING_MOTION);
            pinch.current = {
                distance: getTouchDistance(event.touches),
                transform: transformRef.current,
                anchor: touchMidpoint(event),
            };
        } else if (!('touches' in event) || event.touches.length > 0) {
            // A remaining finger from a pinch cannot start a new gesture.
            if (gesture.current === 'blocked' || gesture.current === 'pinch') return;
            gesture.current = transformRef.current.scale > 1.05 ? 'pan' : 'pending';
            origin.current = lastPoint.current = pointerPoint(event);
            rawOffset.current = 0;
            updateMotion(RESTING_MOTION);
        }
    };

    const handlePointerMove = (event: PointerEvent) => {
        stopEvent(event);
        if (latest.current.busy || pending.current) return;
        if ('touches' in event && event.touches.length >= 2) {
            if (gesture.current !== 'pinch' || !pinch.current.distance) return;
            const scale = Math.max(1, Math.min(5,
                pinch.current.transform.scale * getTouchDistance(event.touches) / pinch.current.distance));
            updateTransform(zoomPhotoAtPoint(
                pinch.current.transform, pinch.current.anchor, touchMidpoint(event), scale, metrics.current,
            ));
            return;
        }
        if (['idle', 'vertical', 'pinch', 'blocked'].includes(gesture.current)
            || ('touches' in event && !event.touches.length)) return;
        const point = pointerPoint(event);
        const dx = point.x - origin.current.x;
        const dy = point.y - origin.current.y;
        if (gesture.current === 'pending') {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
            if (Math.abs(dx) > Math.abs(dy) * 1.2) gesture.current = 'horizontal';
            else if (Math.abs(dy) > Math.abs(dx) * 1.2) gesture.current = 'vertical';
            else return;
        }
        if (gesture.current === 'pan') {
            updateTransform(clampPhotoTransform({
                ...transformRef.current,
                x: transformRef.current.x + point.x - lastPoint.current.x,
                y: transformRef.current.y + point.y - lastPoint.current.y,
            }, metrics.current));
        } else if (gesture.current === 'horizontal') {
            rawOffset.current = dx;
            const neighbour = dx > 0 ? latest.current.previousId : latest.current.nextId;
            updateMotion({ offset: photoSwipeOffset(dx, metrics.current.width, !!neighbour), settling: false });
        }
        lastPoint.current = point;
    };

    const handlePointerUp = (event: PointerEvent) => {
        stopEvent(event);
        if (pending.current) return;
        if ('touches' in event && event.touches.length > 0) {
            gesture.current = 'blocked';
            rawOffset.current = 0;
            updateMotion(RESTING_MOTION);
            return;
        }
        const wasHorizontal = gesture.current === 'horizontal';
        gesture.current = 'idle';
        if (!latest.current.busy && wasHorizontal) {
            const direction = rawOffset.current > PHOTO_SWIPE_THRESHOLD ? -1
                : rawOffset.current < -PHOTO_SWIPE_THRESHOLD ? 1 : 0;
            updateTransform(PHOTO_BASE_TRANSFORM);
            settle(direction);
        } else if (transformRef.current.scale <= 1.05) updateTransform(PHOTO_BASE_TRANSFORM);
        rawOffset.current = 0;
    };

    const handlePointerCancel = (event: TouchEvent<HTMLDivElement>) => {
        stopEvent(event);
        if (pending.current) return;
        gesture.current = event.touches.length ? 'blocked' : 'idle';
        rawOffset.current = 0;
        if (motionRef.current.offset) settle(0);
    };

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        stopEvent(event);
        if (latest.current.busy || pending.current) return;
        metrics.current = measurePhotoViewport(containerRef.current);
        const point = localPhotoPoint(event.clientX, event.clientY, metrics.current);
        const scale = Math.max(1, Math.min(5, transformRef.current.scale * (1 - event.deltaY * 0.001)));
        updateTransform(zoomPhotoAtPoint(transformRef.current, point, point, scale, metrics.current));
    };

    const navigate = (direction: -1 | 1) => {
        if (latest.current.busy || pending.current) return;
        const target = direction < 0 ? latest.current.previousId : latest.current.nextId;
        if (target) { resetView(); latest.current.onNavigate(target); }
    };

    return {
        containerRef, transform, motion, resetView, navigate, finishSlide,
        handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleWheel,
    };
};

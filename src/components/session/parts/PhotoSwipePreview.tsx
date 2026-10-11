import React from 'react';

interface PhotoSwipePreviewProps {
    currentSrc: string;
    previousSrc?: string;
    nextSrc?: string;
    offset: number;
    viewportWidth: number;
    isDragging: boolean;
    transform: { x: number; y: number; scale: number };
}

/** Slide adjacent photos at normal viewing size, clipped by the viewport. */
const PhotoSwipePreview: React.FC<PhotoSwipePreviewProps> = ({
    currentSrc, previousSrc, nextSrc, offset, viewportWidth, isDragging, transform,
}) => {
    const canSwipe = transform.scale <= 1.05 && viewportWidth > 0;
    const visibleOffset = canSwipe ? Math.max(-viewportWidth, Math.min(viewportWidth, offset)) : 0;
    const transition = isDragging ? 'transition-none will-change-transform' : 'transition-transform duration-200 ease-out motion-reduce:transition-none';

    return (
        <>
            <div
                className={`w-full h-full flex items-center justify-center ${transition}`}
                style={{ transform: `translateX(${visibleOffset}px)` }}
            >
                <img
                    src={currentSrc}
                    alt="Full view"
                    className="max-w-full max-h-full object-contain select-none"
                    style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        cursor: transform.scale > 1 ? 'grab' : 'default',
                    }}
                    draggable={false}
                />
            </div>
            {/* Source keys avoid animating a different neighbour after navigation. */}
            {[
                { src: previousSrc, side: 'previous', position: '-100%' },
                { src: nextSrc, side: 'next', position: '100%' },
            ].map(({ src, side, position }) => src ? (
                <div
                    key={`${side}:${src}`}
                    data-photo-preview={side}
                    aria-hidden="true"
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none ${transition}`}
                    style={{ transform: `translateX(${position}) translateX(${visibleOffset}px)` }}
                >
                    <img src={src} alt="" draggable={false}
                        className="max-w-full max-h-full object-contain select-none" />
                </div>
            ) : null)}
        </>
    );
};

export default PhotoSwipePreview;

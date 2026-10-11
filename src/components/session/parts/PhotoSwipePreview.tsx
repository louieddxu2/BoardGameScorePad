import React from 'react';
import type { LoadedImage } from '../modals/PhotoGalleryModal';
import { PHOTO_PAGE_GAP, PHOTO_SLIDE_DURATION, type PhotoTransform } from '../../../utils/photoViewerGeometry';

interface PhotoSwipePreviewProps {
    currentSrc: string;
    images: LoadedImage[];
    currentIndex: number;
    offset: number;
    settling: boolean;
    transform: PhotoTransform;
    onSettled: () => void;
}

/** Slide adjacent photos at normal viewing size, clipped by the viewport. */
const PhotoSwipePreview: React.FC<PhotoSwipePreviewProps> = ({
    currentSrc, images, currentIndex, offset, settling, transform, onSettled,
}) => {
    const firstIndex = Math.max(0, currentIndex - 1);
    const transition = settling ? 'transition-transform ease-out motion-reduce:transition-none' : 'transition-none';

    return (
        <div
            data-photo-track="true"
            className={`relative w-full h-full ${transition} ${offset ? 'will-change-transform' : ''}`}
            style={{ transform: `translateX(${offset}px)`, transitionDuration: settling ? `${PHOTO_SLIDE_DURATION}ms` : undefined }}
            onTransitionEnd={event => {
                if (event.target === event.currentTarget && (!event.propertyName || event.propertyName === 'transform')) onSettled();
            }}
        >
            {/* IDs keep the arriving image mounted when its page becomes current. */}
            {images.slice(firstIndex, currentIndex + 2).map((image, i) => {
                const page = firstIndex + i - currentIndex;
                const isCurrent = page === 0;
                return (
                    <div
                        key={image.id}
                        data-photo-preview={isCurrent ? undefined : page < 0 ? 'previous' : 'next'}
                        aria-hidden={isCurrent ? undefined : true}
                        className={`absolute inset-0 flex items-center justify-center ${isCurrent ? '' : 'pointer-events-none'}`}
                        style={{ transform: `translateX(${page * 100}%) translateX(${page * PHOTO_PAGE_GAP}px)` }}
                    >
                        <img src={isCurrent ? currentSrc : image.url} alt={isCurrent ? 'Full view' : ''} draggable={false}
                            className="max-w-full max-h-full object-contain select-none"
                            style={isCurrent ? {
                                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                                cursor: transform.scale > 1 ? 'grab' : 'default',
                            } : undefined} />
                    </div>
                );
            })}
        </div>
    );
};

export default PhotoSwipePreview;

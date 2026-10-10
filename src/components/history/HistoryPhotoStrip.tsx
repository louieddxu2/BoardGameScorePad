import React from 'react';
import { usePhotoImages } from '../../hooks/usePhotoImages';
import type { PhotoContentIds } from '../../types';

interface HistoryPhotoStripProps {
    photoIds: string[];
    photoContentIds?: PhotoContentIds;
    onPhotoClick: (photoId: string) => void;
}

const HistoryPhotoStrip: React.FC<HistoryPhotoStripProps> = ({ photoIds, photoContentIds, onPhotoClick }) => {
    const { images: thumbnails } = usePhotoImages(photoIds, photoContentIds);

    if (thumbnails.length === 0) return null;

    return (
        <div
            data-history-photo-strip="true"
            className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain snap-x snap-proximity pb-1"
        >
            {thumbnails.map((thumbnail, index) => (
                <button
                    key={thumbnail.id}
                    type="button"
                    className="w-24 h-20 shrink-0 snap-start overflow-hidden rounded-xl border border-surface-border bg-surface-recessed active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"
                    onClick={() => onPhotoClick(thumbnail.id)}
                    aria-label={`Session Photo ${index + 1}`}
                >
                    <img
                        src={thumbnail.url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                </button>
            ))}
        </div>
    );
};

export default HistoryPhotoStrip;

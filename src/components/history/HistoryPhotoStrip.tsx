import React, { useEffect, useState } from 'react';
import { imageService } from '../../services/imageService';

interface HistoryPhotoStripProps {
    photoIds: string[];
    onPhotoClick: (photoId: string) => void;
}

interface Thumbnail {
    id: string;
    url: string;
}

const HistoryPhotoStrip: React.FC<HistoryPhotoStripProps> = ({ photoIds, onPhotoClick }) => {
    const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);

    useEffect(() => {
        let active = true;
        const generatedUrls: string[] = [];

        const loadThumbnails = async () => {
            const loaded: Thumbnail[] = [];
            setThumbnails([]);

            for (const id of [...photoIds].reverse()) {
                if (!active) break;
                try {
                    const image = await imageService.getImage(id);
                    if (image) {
                        const url = URL.createObjectURL(image.blob);
                        generatedUrls.push(url);
                        loaded.push({ id, url });
                    }
                } catch (error) {
                    console.error(`Failed to load history thumbnail ${id}`, error);
                }
            }

            if (active) {
                setThumbnails(loaded);
            }
        };

        loadThumbnails();

        return () => {
            active = false;
            generatedUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [photoIds]);

    if (thumbnails.length === 0) return null;

    const keepStripTouchLocal = (event: React.TouchEvent) => event.stopPropagation();

    return (
        <div
            data-history-photo-strip="true"
            className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain snap-x snap-proximity pb-1"
            onTouchStart={keepStripTouchLocal}
            onTouchMove={keepStripTouchLocal}
            onTouchEnd={keepStripTouchLocal}
            onTouchCancel={keepStripTouchLocal}
        >
            {thumbnails.map((thumbnail, index) => (
                <button
                    key={thumbnail.id}
                    type="button"
                    className="w-20 h-16 shrink-0 snap-start overflow-hidden rounded-xl border border-surface-border bg-surface-recessed active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"
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

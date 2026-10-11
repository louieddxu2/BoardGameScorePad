export const PHOTO_PAGE_GAP = 16;
export const PHOTO_SLIDE_DURATION = 200;
export const PHOTO_SWIPE_THRESHOLD = 80;
export const PHOTO_BASE_TRANSFORM = { x: 0, y: 0, scale: 1 };

export interface PhotoTransform { x: number; y: number; scale: number }
export interface PhotoPoint { x: number; y: number }
export interface PhotoMetrics {
    width: number;
    height: number;
    left: number;
    top: number;
    imageWidth: number;
    imageHeight: number;
}

/** Sample the viewport and fitted image once at gesture start, never on moves. */
export const measurePhotoViewport = (viewport: HTMLDivElement | null): PhotoMetrics => {
    const width = viewport?.clientWidth ?? 0;
    const height = viewport?.clientHeight ?? 0;
    const rect = viewport?.getBoundingClientRect();
    const image = viewport?.querySelector<HTMLImageElement>('img[alt="Full view"]');
    const naturalWidth = image?.naturalWidth ?? 0;
    const naturalHeight = image?.naturalHeight ?? 0;
    const fit = naturalWidth && naturalHeight && width && height
        ? Math.min(1, width / naturalWidth, height / naturalHeight) : 0;
    return {
        width, height, left: rect?.left ?? 0, top: rect?.top ?? 0,
        imageWidth: naturalWidth * fit, imageHeight: naturalHeight * fit,
    };
};

export const localPhotoPoint = (x: number, y: number, metrics: PhotoMetrics): PhotoPoint => (
    metrics.width > 0 && metrics.height > 0
        ? { x: x - metrics.left - metrics.width / 2, y: y - metrics.top - metrics.height / 2 }
        : { x: 0, y: 0 }
);

export const clampPhotoTransform = (transform: PhotoTransform, metrics: PhotoMetrics): PhotoTransform => {
    // Dimensions can be unavailable before an image finishes loading.
    if (!metrics.imageWidth || !metrics.imageHeight) return transform;
    const maxX = Math.max(0, (metrics.imageWidth * transform.scale - metrics.width) / 2);
    const maxY = Math.max(0, (metrics.imageHeight * transform.scale - metrics.height) / 2);
    return {
        ...transform,
        x: Math.max(-maxX, Math.min(maxX, transform.x)),
        y: Math.max(-maxY, Math.min(maxY, transform.y)),
    };
};

/** Keep the photo point under the fingers stable while their midpoint moves. */
export const zoomPhotoAtPoint = (
    start: PhotoTransform, anchor: PhotoPoint, point: PhotoPoint, scale: number, metrics: PhotoMetrics,
): PhotoTransform => clampPhotoTransform({
    scale,
    x: point.x - (anchor.x - start.x) / start.scale * scale,
    y: point.y - (anchor.y - start.y) / start.scale * scale,
}, metrics);

export const photoSwipeOffset = (raw: number, width: number, hasNeighbour: boolean): number => {
    if (!width) return 0;
    if (!hasNeighbour) return raw * 0.3 / (1 + Math.abs(raw) / width);
    const stride = width + PHOTO_PAGE_GAP;
    return Math.max(-stride, Math.min(stride, raw));
};

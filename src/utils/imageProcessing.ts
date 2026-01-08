
import { Rect } from '../types';

// --- Image Cache System ---
const globalImageCache: Map<string, HTMLImageElement> = new Map();
const globalPendingLoads: Map<string, Promise<HTMLImageElement>> = new Map();

/**
 * Helper to load image with caching.
 * Prevents multiple decodes of the same large background image.
 */
const loadCachedImage = (src: string): Promise<HTMLImageElement> => {
    if (globalImageCache.has(src)) {
        return Promise.resolve(globalImageCache.get(src)!);
    }
    
    if (globalPendingLoads.has(src)) {
        return globalPendingLoads.get(src)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async'; // Important for performance
        img.crossOrigin = 'anonymous'; // Good practice for export
        
        img.onload = () => {
            globalImageCache.set(src, img);
            globalPendingLoads.delete(src);
            resolve(img);
        };
        img.onerror = (e) => {
            globalPendingLoads.delete(src);
            reject(e);
        };
        img.src = src;
    });

    globalPendingLoads.set(src, promise);
    return promise;
};

/**
 * Creates a CSS background-image string (url(...)) from a source image and crop rect.
 * Note: For small crops (headers/cells), DataURL is acceptable as they are small and many.
 */
export const cropImageToDataUrl = async (sourceImageSrc: string, rect: Rect): Promise<string> => {
    try {
        const img = await loadCachedImage(sourceImageSrc);
        
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");
        
        ctx.drawImage(
            img,
            rect.x, rect.y, rect.width, rect.height, // Source
            0, 0, rect.width, rect.height // Dest
        );
        
        return canvas.toDataURL('image/jpeg', 0.9);
    } catch (e) {
        console.warn("Crop failed", e);
        return '';
    }
};

/**
 * Smart Texture Cropper
 */
export const getSmartTextureUrl = async (sourceImageSrc: string, baseRect: Rect, playerIndex: number, limitX?: number): Promise<string> => {
    try {
        const img = await loadCachedImage(sourceImageSrc);

        const imgW = img.width;
        const colW = baseRect.width;
        const baseX = baseRect.x;

        const effectiveW = limitX ? Math.min(imgW, limitX) : imgW;
        // Prevent division by zero
        if (colW <= 0) return '';

        const maxCols = Math.floor((effectiveW - baseX - (colW * 0.5)) / colW);
        const validCount = Math.max(1, maxCols + 1); 
        const effectiveIndex = playerIndex % validCount;
        const targetX = baseX + (effectiveIndex * colW);

        const availableWidth = imgW - targetX;
        const finalWidth = Math.min(colW, availableWidth);

        if (finalWidth <= 0) return '';

        const canvas = document.createElement('canvas');
        canvas.width = colW; 
        canvas.height = baseRect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        ctx.drawImage(
            img,
            targetX, baseRect.y, finalWidth, baseRect.height, 
            0, 0, colW, baseRect.height 
        );
        
        return canvas.toDataURL('image/jpeg', 0.9);
    } catch (e) {
        console.warn("Smart texture crop failed", e);
        return '';
    }
};

/**
 * Optimized Smart Compress & Resize (Blob Version)
 * 
 * Returns a Blob directly instead of a Base64 string.
 * This saves ~33% storage space and avoids main-thread freezing during string conversion.
 */
export const compressAndResizeImage = async (
    source: string | Blob, 
    targetMB: number = 1, 
    maxWidth: number = 1920
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // [Optimization] Critical for large photos: Perform decoding off the main thread.
        img.decoding = 'async'; 
        
        const srcUrl = typeof source === 'string' ? source : URL.createObjectURL(source);

        img.onload = () => {
            // Clean up object URL if we created one
            if (typeof source !== 'string') URL.revokeObjectURL(srcUrl);

            let w = img.width;
            let h = img.height;

            // 1. Resize Logic (Maintain Aspect Ratio)
            if (w > maxWidth || h > maxWidth) {
                const ratio = Math.min(maxWidth / w, maxWidth / h);
                w = Math.floor(w * ratio);
                h = Math.floor(h * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error("Canvas context failed"));
                return;
            }

            // This drawImage performs the resizing. 
            // Since we set canvas dimensions to 'w'/'h' (the smaller target size), 
            // the memory footprint of the canvas is small.
            ctx.drawImage(img, 0, 0, w, h);

            // 2. Compress directly to Blob
            // canvas.toBlob is async and efficient
            const attemptCompression = (quality: number) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Compression failed"));
                        return;
                    }

                    // Check size
                    if (blob.size > targetMB * 1024 * 1024 && quality > 0.5) {
                        // If still too big, try drastic reduction
                        attemptCompression(0.5);
                    } else {
                        resolve(blob);
                    }
                }, 'image/jpeg', quality);
            };

            // Start with 0.8 quality (sweet spot)
            attemptCompression(0.8);
        };
        
        img.onerror = (e) => {
            if (typeof source !== 'string') URL.revokeObjectURL(srcUrl);
            reject(e);
        };

        img.src = srcUrl;
    });
};

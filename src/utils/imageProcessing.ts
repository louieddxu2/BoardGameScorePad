
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
 * [Fix] Correctly converts normalized coordinates (0-1) to integer pixels for canvas dimensions.
 */
export const cropImageToDataUrl = async (sourceImageSrc: string, rect: Rect): Promise<string> => {
    try {
        const img = await loadCachedImage(sourceImageSrc);
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        // 1. Determine if input is Percentage (0-1) or Legacy Pixels (>1)
        // New templates use 0-1.
        const isPercentage = rect.x <= 1.0 && rect.y <= 1.0 && rect.width <= 1.0 && rect.height <= 1.0;

        let pixelX, pixelY, pixelW, pixelH;

        if (isPercentage) {
            pixelX = Math.floor(rect.x * imgW);
            pixelY = Math.floor(rect.y * imgH);
            pixelW = Math.floor(rect.width * imgW);
            pixelH = Math.floor(rect.height * imgH);
        } else {
            // Legacy fallback
            pixelX = rect.x;
            pixelY = rect.y;
            pixelW = rect.width;
            pixelH = rect.height;
        }

        // Safety check for invalid dimensions to prevent canvas error
        // Ensure at least 1x1 pixel
        if (pixelW <= 0) pixelW = 1;
        if (pixelH <= 0) pixelH = 1;

        const canvas = document.createElement('canvas');
        // [CRITICAL FIX] Set canvas size to calculated PIXELS, not percentage floats
        canvas.width = pixelW;
        canvas.height = pixelH;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");
        
        ctx.drawImage(
            img,
            pixelX, pixelY, pixelW, pixelH, // Source (Pixels)
            0, 0, pixelW, pixelH // Dest (Pixels)
        );
        
        return canvas.toDataURL('image/jpeg', 0.95); // High quality for UI crops
    } catch (e) {
        console.warn("Crop failed", e);
        return '';
    }
};

/**
 * Smart Texture Cropper for Repeated Columns
 * [Fix] Correctly calculates offset and converts to pixels.
 */
export const getSmartTextureUrl = async (sourceImageSrc: string, baseRect: Rect, playerIndex: number, limitX?: number): Promise<string> => {
    try {
        const img = await loadCachedImage(sourceImageSrc);
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        // 1. Determine Coordinate System
        const isPercentage = baseRect.x <= 1.0 && baseRect.width <= 1.0;

        let baseX, colW, pixelY, pixelH;
        let effectiveLimitW = imgW;

        if (isPercentage) {
            baseX = baseRect.x * imgW;
            colW = baseRect.width * imgW;
            pixelY = baseRect.y * imgH;
            pixelH = baseRect.height * imgH;
            if (limitX !== undefined && limitX <= 1.0) {
                effectiveLimitW = limitX * imgW;
            }
        } else {
            baseX = baseRect.x;
            colW = baseRect.width;
            pixelY = baseRect.y;
            pixelH = baseRect.height;
            if (limitX !== undefined) {
                effectiveLimitW = limitX;
            }
        }

        // Prevent division by zero logic
        if (colW < 1) colW = 1;

        // Calculate repetition
        // Logic: How many columns fit before the limit?
        // Start X of current player = BaseX + (Index * Width)
        const maxCols = Math.floor((effectiveLimitW - baseX - (colW * 0.5)) / colW);
        const validCount = Math.max(1, maxCols + 1); 
        
        // Cycle index if it exceeds available space
        const effectiveIndex = playerIndex % validCount;
        
        const targetX = Math.floor(baseX + (effectiveIndex * colW));
        const finalWidth = Math.floor(colW);
        const finalHeight = Math.floor(pixelH);

        if (finalWidth <= 0 || finalHeight <= 0) return '';

        const canvas = document.createElement('canvas');
        // [CRITICAL FIX] Set canvas dimensions to calculated pixels
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        ctx.drawImage(
            img,
            targetX, pixelY, finalWidth, finalHeight, 
            0, 0, finalWidth, finalHeight 
        );
        
        return canvas.toDataURL('image/jpeg', 0.95); // High quality for textures
    } catch (e) {
        console.warn("Smart texture crop failed", e);
        return '';
    }
};

/**
 * Optimized Smart Compress & Resize (Blob Version)
 * Strategy: Start at high quality (0.95). If file is too large (>1MB),
 * step down quality gradually instead of dropping instantly to 0.5.
 */
export const compressAndResizeImage = async (
    source: string | Blob, 
    targetMB: number = 1, 
    maxWidth: number = 1920
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async'; 
        
        const srcUrl = typeof source === 'string' ? source : URL.createObjectURL(source);

        img.onload = () => {
            if (typeof source !== 'string') URL.revokeObjectURL(srcUrl);

            let w = img.width;
            let h = img.height;

            // Only resize if significantly larger (to avoid minor resampling blur)
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

            // Use high quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const targetBytes = targetMB * 1024 * 1024;

            // Recursive compression with gradual step-down
            const attemptCompression = (quality: number) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Compression failed"));
                        return;
                    }
                    
                    // If size fits OR we've reached minimum acceptable quality, resolve.
                    // Minimum quality increased to 0.6 to prevent pixelation.
                    if (blob.size <= targetBytes || quality <= 0.6) {
                        resolve(blob);
                    } else {
                        // Gradual step down: 0.95 -> 0.85 -> 0.70 -> 0.55
                        const nextQuality = quality - 0.15;
                        attemptCompression(Math.max(0.5, nextQuality));
                    }
                }, 'image/jpeg', quality);
            };

            // Start with very high quality
            attemptCompression(0.95);
        };
        
        img.onerror = (e) => {
            if (typeof source !== 'string') URL.revokeObjectURL(srcUrl);
            reject(e);
        };

        img.src = srcUrl;
    });
};

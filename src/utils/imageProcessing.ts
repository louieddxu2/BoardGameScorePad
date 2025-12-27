
import { Rect } from '../types';

/**
 * Creates a CSS background-image string (url(...)) from a source image and crop rect.
 */
export const cropImageToDataUrl = async (sourceImageSrc: string, rect: Rect): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("No context"));
                return;
            }
            
            ctx.drawImage(
                img,
                rect.x, rect.y, rect.width, rect.height, // Source
                0, 0, rect.width, rect.height // Dest
            );
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = sourceImageSrc;
    });
};

/**
 * Smart Texture Cropper
 * Calculates the correct X offset for a specific player index.
 * If the calculated position exceeds the image bounds (with <50% overlap),
 * it wraps around to the beginning using modulo arithmetic.
 * 
 * limitX: Optional right boundary (in pixels) to enforce wrapping before image edge.
 */
export const getSmartTextureUrl = async (sourceImageSrc: string, baseRect: Rect, playerIndex: number, limitX?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const imgW = img.width;
            const colW = baseRect.width;
            const baseX = baseRect.x;

            // 1. Determine effective width boundary.
            // If limitX is provided (e.g., from Right Bound), use it. Otherwise use full image width.
            const effectiveW = limitX ? Math.min(imgW, limitX) : imgW;

            // 2. Determine how many valid columns fit within the effective width.
            // A column is valid if at least 50% of it is within the boundary.
            // Formula: (Start X of column 'i') + (50% of width) <= Effective Width
            // (baseX + i * colW) + (colW * 0.5) <= effectiveW
            const maxCols = Math.floor((effectiveW - baseX - (colW * 0.5)) / colW);
            
            // Ensure we have at least 1 column (the original one), even if image/limit is weirdly small
            const validCount = Math.max(1, maxCols + 1); // +1 because index is 0-based

            // 3. Calculate effective index (Wrap around logic)
            const effectiveIndex = playerIndex % validCount;
            
            // 4. Calculate target X position
            const targetX = baseX + (effectiveIndex * colW);

            // 5. Handle edge clipping (relative to real image width, not limitX)
            // Even if valid (>=50% inside limit), the right edge might still be cut off by image edge.
            // We clamp the width to not exceed image bounds.
            const availableWidth = imgW - targetX;
            const finalWidth = Math.min(colW, availableWidth);

            if (finalWidth <= 0) {
                resolve(''); 
                return;
            }

            const canvas = document.createElement('canvas');
            // We maintain the original requested width for the canvas to ensure consistent CSS sizing.
            canvas.width = colW; 
            canvas.height = baseRect.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error("No context")); return; }

            // Draw the slice, stretching it horizontally if the source is narrower than the target.
            ctx.drawImage(
                img,
                targetX, baseRect.y, finalWidth, baseRect.height, // Source: cropped to what's available
                0, 0, colW, baseRect.height // Destination: always stretch to full column width
            );
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = sourceImageSrc;
    });
};

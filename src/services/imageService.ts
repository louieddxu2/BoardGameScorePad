
import { db } from '../db';
import { LocalImage } from '../types';
import { generateId } from '../utils/idGenerator';

export class ImageService {
    
    // --- Basic CRUD ---

    /**
     * Save a Blob to the local database
     * @param blob The image blob
     * @param relatedId The ID of the template or session
     * @param relatedType Type of relation
     * @param forcedId (Optional) Force a specific UUID. Used during cloud restoration to maintain consistency.
     */
    async saveImage(blob: Blob, relatedId: string, relatedType: 'template' | 'session', forcedId?: string): Promise<LocalImage> {
        const id = forcedId || generateId();
        const image: LocalImage = {
            id,
            relatedId,
            relatedType,
            blob,
            mimeType: blob.type,
            createdAt: Date.now(),
            isSynced: false
        };
        // Use put instead of add to handle potential overwrites gracefully (idempotency)
        await db.images.put(image); 
        return image;
    }

    /**
     * Get a single image by ID
     */
    async getImage(id: string): Promise<LocalImage | undefined> {
        return await db.images.get(id);
    }

    /**
     * Get all images related to a specific entity (Template or Session)
     */
    async getImagesByRelatedId(relatedId: string): Promise<LocalImage[]> {
        return await db.images.where('relatedId').equals(relatedId).toArray();
    }

    /**
     * Delete an image
     */
    async deleteImage(id: string): Promise<void> {
        await db.images.delete(id);
    }

    /**
     * Delete all images associated with a related ID
     */
    async deleteImagesByRelatedId(relatedId: string): Promise<void> {
        const images = await this.getImagesByRelatedId(relatedId);
        if (images.length > 0) {
            const ids = images.map(img => img.id);
            await db.images.bulkDelete(ids);
        }
    }

    // --- Utility ---

    /**
     * Convert Base64 string to Blob
     */
    base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeType });
    }

    /**
     * Convert Blob to Base64 (Data URL)
     */
    blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

export const imageService = new ImageService();

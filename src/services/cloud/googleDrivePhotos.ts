import { googleDriveClient } from './googleDriveClient';
import { imageService } from '../imageService';
import type { PhotoContentIds } from '../../types';

const photoCloudKey = (id: string, contentId?: string) => contentId ? `${id}@${contentId}` : id;
const photoFilename = (id: string, contentId?: string) => contentId ? `${id}_${contentId}.jpg` : `${id}.jpg`;

/**
 * Helper: Backup Photos for Session/History
 * 1. Uploads missing photos and collects their Cloud IDs.
 * 2. Commits the referencing JSON before cleaning known obsolete photos.
 * Returns the updated photoCloudIds map.
 */
export async function backupSessionPhotos(
    folderId: string,
    photoIds: string[] | undefined,
    existingCloudIds: Record<string, string> | undefined,
    contentIds: PhotoContentIds | undefined,
    commitRecord: (cloudIds: Record<string, string>) => Promise<void>,
): Promise<Record<string, string>> {
    const resultCloudIds: Record<string, string> = {};
    const validFiles = new Map<string, string>();
    for (const id of photoIds || []) {
        const key = photoCloudKey(id, contentIds?.[id]);
        validFiles.set(photoFilename(id, contentIds?.[id]), key);
        if (existingCloudIds?.[key]) resultCloudIds[key] = existingCloudIds[key];
    }

    // 1. Upload Missing Photos & Capture IDs
    for (const photoId of photoIds || []) {
        const contentId = contentIds?.[photoId];
        const key = photoCloudKey(photoId, contentId);
        // An unchanged revision still needs no image/database read.
        if (resultCloudIds[key]) continue;

        try {
            const localImg = await imageService.getImage(photoId);
            if (contentId && (!localImg || localImg.contentId !== contentId)) {
                throw new Error('Edited photo revision is not available');
            }
            if (localImg && localImg.blob) {
                const mimeType = localImg.mimeType || 'image/jpeg';
                const filename = photoFilename(photoId, contentId);

                // Note: uploadFileToFolder performs a find-or-create logic
                const uploadedFile = await googleDriveClient.uploadFileToFolder(folderId, filename, mimeType, localImg.blob);

                if (uploadedFile && uploadedFile.id) {
                    resultCloudIds[key] = uploadedFile.id;
                } else if (contentId) {
                    throw new Error('Edited photo upload returned no file ID');
                }
            }
        } catch (e) {
            console.warn(`Failed to upload photo ${photoId}`, e);
            // Do not overwrite the backup JSON or trash its last good photo
            // when a replacement version has not been safely uploaded.
            if (contentId) throw e;
        }
    }

    // Keep one folder listing, both to recover missing IDs and to identify
    // known obsolete files. An unknown revision may belong to another device.
    let cloudFiles: Awaited<ReturnType<typeof googleDriveClient.fetchAllItems>> = [];
    try {
        cloudFiles = await googleDriveClient.fetchAllItems(
            `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            'files(id, name)'
        );

        for (const file of cloudFiles) {
            const key = validFiles.get(file.name);
            if (key && !resultCloudIds[key]) resultCloudIds[key] = file.id;
        }
    } catch (e) {
        console.warn('Failed to list session photos', e);
    }

    // A failed JSON/metadata write must leave every previously referenced photo intact.
    await commitRecord(resultCloudIds);
    const previousIds = new Set(Object.values(existingCloudIds || {}));
    const currentIds = new Set(Object.values(resultCloudIds));
    const protectedFiles = new Set(['data.json', 'session.json', 'background.jpg']);
    try {
        for (const file of cloudFiles) {
            if (file.name.endsWith('.jpg') && !protectedFiles.has(file.name) &&
                previousIds.has(file.id) && !currentIds.has(file.id)) {
                await googleDriveClient.trashFile(file.id);
            }
        }
    } catch (e) {
        console.warn('Failed to cleanup stale session photos', e);
    }

    return resultCloudIds;
}

/**
 * Helper: Restore Photos for Session/History
 * Uses `photoCloudIds` map for direct access (O(1)) instead of searching.
 */
export async function restoreSessionPhotos(
    photoIds: string[] | undefined,
    photoCloudIds: Record<string, string> | undefined,
    relatedId: string,
    contentIds?: PhotoContentIds,
) {
    if (!photoIds || photoIds.length === 0) return;
    if (!photoCloudIds) return; // Cannot restore efficiently without map

    for (const photoId of photoIds) {
        // 1. Check if exists locally
        const exists = await imageService.getImage(photoId);
        const contentId = contentIds?.[photoId];
        if (exists && exists.contentId === contentId) continue;

        // 2. Direct download using ID from map
        const fileId = photoCloudIds[photoCloudKey(photoId, contentId)];
        if (fileId) {
            try {
                const blob = await googleDriveClient.downloadBlob(fileId);
                // Save with forced ID to match the JSON record
                if (contentId) await imageService.saveImage(blob, relatedId, 'session', photoId, contentId);
                else await imageService.saveImage(blob, relatedId, 'session', photoId);
            } catch (e) {
                console.warn(`Failed to restore photo ${photoId} using ID ${fileId}`, e);
            }
        } else {
            console.warn(`No cloud ID found for photo ${photoId}`);
        }
    }
}

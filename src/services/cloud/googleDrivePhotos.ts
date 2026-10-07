import { googleDriveClient } from './googleDriveClient';
import { imageService } from '../imageService';

/**
 * Helper: Backup Photos for Session/History
 * 1. Uploads missing photos and collects their Cloud IDs.
 * 2. Cleans up stale photos (files in cloud that are not in the current list).
 * Returns the updated photoCloudIds map.
 */
export async function backupSessionPhotos(
    folderId: string,
    photoIds: string[] | undefined,
    existingCloudIds: Record<string, string> | undefined
): Promise<Record<string, string>> {
    const resultCloudIds: Record<string, string> = { ...(existingCloudIds || {}) };
    const validPhotoIds = new Set(photoIds || []);

    // 1. Upload Missing Photos & Capture IDs
    for (const photoId of photoIds || []) {
        // If we already have a Cloud ID for this photo, assume it's good (optimization)
        if (resultCloudIds[photoId]) continue;

        try {
            const localImg = await imageService.getImage(photoId);
            if (localImg && localImg.blob) {
                const mimeType = localImg.mimeType || 'image/jpeg';
                const filename = `${photoId}.jpg`;

                // Note: uploadFileToFolder performs a find-or-create logic
                const uploadedFile = await googleDriveClient.uploadFileToFolder(folderId, filename, mimeType, localImg.blob);

                if (uploadedFile && uploadedFile.id) {
                    resultCloudIds[photoId] = uploadedFile.id;
                }
            }
        } catch (e) {
            console.warn(`Failed to upload photo ${photoId}`, e);
        }
    }

    // 2. Cleanup Stale Photos (Hygiene)
    // We list ALL files in the folder to ensure we don't leave orphans.
    // This listing is acceptable during backup (write op) to save storage.
    try {
        const cloudFiles = await googleDriveClient.fetchAllItems(
            `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            'files(id, name)'
        );

        // Protected files that shouldn't be deleted
        const protectedFiles = new Set(['data.json', 'session.json', 'background.jpg']);

        for (const file of cloudFiles) {
            if (protectedFiles.has(file.name)) continue;

            // Check if it's an image associated with this session
            if (file.name.endsWith('.jpg')) {
                const uuid = file.name.replace('.jpg', '');

                // If this UUID is NOT in our valid list, delete it (softly trash it)
                if (!validPhotoIds.has(uuid)) {
                    await googleDriveClient.trashFile(file.id);
                    // Also remove from result map if present
                    delete resultCloudIds[uuid];
                } else {
                    // If it IS valid, ensure it's in our map (healing self-repair)
                    if (!resultCloudIds[uuid]) {
                        resultCloudIds[uuid] = file.id;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to cleanup stale session photos", e);
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
    relatedId: string
) {
    if (!photoIds || photoIds.length === 0) return;
    if (!photoCloudIds) return; // Cannot restore efficiently without map

    for (const photoId of photoIds) {
        // 1. Check if exists locally
        const exists = await imageService.getImage(photoId);
        if (exists) continue;

        // 2. Direct download using ID from map
        const fileId = photoCloudIds[photoId];
        if (fileId) {
            try {
                const blob = await googleDriveClient.downloadBlob(fileId);
                // Save with forced ID to match the JSON record
                await imageService.saveImage(blob, relatedId, 'session', photoId);
            } catch (e) {
                console.warn(`Failed to restore photo ${photoId} using ID ${fileId}`, e);
            }
        } else {
            console.warn(`No cloud ID found for photo ${photoId}`);
        }
    }
}

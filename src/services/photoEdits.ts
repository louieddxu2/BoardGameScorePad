import { db } from '../db';
import type { LocalImage } from '../types';

/** Write real image bytes and their backup revision in one transaction. */
export const saveRotatedPhoto = async (
  image: LocalImage,
  expectedContentId: string | undefined,
  contextId: string,
  ownerType: 'session' | 'history',
): Promise<void> => {
  const ownerTable = ownerType === 'history' ? db.history : db.sessions;
  await db.transaction('rw', db.images, ownerTable, async () => {
    const current = await db.images.get(image.id);
    const owner = await ownerTable.get(contextId);
    if (!current || !owner || current.relatedType !== 'session' || current.relatedId !== contextId) {
      throw new Error('Photo is no longer available in this record');
    }
    if (!image.contentId || current.contentId !== expectedContentId) {
      throw new Error('Photo changed while rotating; reopen it and try again');
    }
    // Keep identity/association from the stored row, not from a UI snapshot.
    await db.images.put({
      ...current,
      blob: image.blob,
      mimeType: image.blob.type,
      contentId: image.contentId,
      rotationSource: image.rotationSource,
      isSynced: false,
    });
    const revisionPatch = { photoContentIds: { ...owner.photoContentIds, [image.id]: image.contentId } };
    await ownerTable.update(contextId, ownerType === 'history'
      ? { ...revisionPatch, updatedAt: Date.now() }
      : { ...revisionPatch, lastUpdatedAt: Date.now() });
  });
};

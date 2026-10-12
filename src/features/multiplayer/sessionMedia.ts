import type { GameSession } from '../../types';

/** Photos are local assets, not score inputs or host-authoritative results. */
export const getSessionMedia = (session: GameSession) => ({
  photos: session.photos,
  photoContentIds: session.photoContentIds,
  photoCloudIds: session.photoCloudIds,
  cloudFolderId: session.cloudFolderId,
});

export const preserveLocalSessionMedia = (incoming: GameSession, local: GameSession): GameSession => ({
  ...incoming,
  ...getSessionMedia(local),
  ...(local.lastUpdatedAt !== undefined && local.lastUpdatedAt > (incoming.lastUpdatedAt ?? 0)
    ? { lastUpdatedAt: local.lastUpdatedAt } : {}),
});

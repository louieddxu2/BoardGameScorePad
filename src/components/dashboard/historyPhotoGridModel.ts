import type { CSSProperties } from 'react';
import type { HistoryPhotoGridItem } from '../../utils/historyStats';
import { getInitialHistoryPhotoGridCrop, type HistoryPhotoGridCrop, type HistoryPhotoGridImageSize } from '../../utils/historyPhotoGrid';
import { DATA_LIMITS } from '../../dataLimits';

export interface LoadedGridPhoto {
  id: string;
  itemKey: string;
  recordId: string;
  gameKey: string;
  gameName: string;
  endTime: number;
  url: string;
  imageSize: HistoryPhotoGridImageSize;
}

export interface EditableGridTile extends LoadedGridPhoto {
  crop: HistoryPhotoGridCrop;
}

export interface CropDraft extends EditableGridTile {
  tileIndex: number;
}

export const EXPORT_GRID_WIDTH = 1080;
export const PHOTO_RECAP_TILE_COUNT = 8;
export const PHOTO_RECAP_TILE_ASPECT = 16 / 9;
export const PHOTO_RECAP_CAPTION_HEIGHT_RATIO = 0.08;
export const PHOTO_RECAP_ROW_GAP_HEIGHT_RATIO = 0.02;
export const getLimitedCandidatePhotos = (item: HistoryPhotoGridItem) => (
  item.candidatePhotos.slice(0, DATA_LIMITS.QUERY.HISTORY_PHOTO_GRID_CANDIDATES)
);

export const getTileFrameAspect = (_tile: Pick<EditableGridTile, 'imageSize'>): number => (
  PHOTO_RECAP_TILE_ASPECT
);

export const getImageSize = (url: string): Promise<HistoryPhotoGridImageSize> => {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = url;
  });
};

export const getCropFrameStyle = (tile: EditableGridTile): CSSProperties => {
  const aspect = getTileFrameAspect(tile);
  const maxWidthByHeight = Number((64 * aspect).toFixed(4));
  return {
    aspectRatio: aspect,
    width: `min(86vw, ${maxWidthByHeight}dvh)`
  };
};

export const formatGridDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
};

export const createTileFromPhoto = (photo: LoadedGridPhoto): EditableGridTile => ({
  ...photo,
  crop: getInitialHistoryPhotoGridCrop(photo.imageSize, PHOTO_RECAP_TILE_ASPECT)
});

export const toTile = (draft: CropDraft): EditableGridTile => ({
  id: draft.id,
  itemKey: draft.itemKey,
  recordId: draft.recordId,
  gameKey: draft.gameKey,
  gameName: draft.gameName,
  endTime: draft.endTime,
  url: draft.url,
  imageSize: draft.imageSize,
  crop: draft.crop
});

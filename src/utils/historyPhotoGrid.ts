export type HistoryPhotoGridFitMode = 'cover' | 'contain';

export const LANDSCAPE_CONTAIN_RATIO = 1.2;

export const getDefaultHistoryPhotoGridFitMode = (
  width: number,
  height: number
): HistoryPhotoGridFitMode => {
  if (width <= 0 || height <= 0) return 'cover';
  return width / height > LANDSCAPE_CONTAIN_RATIO ? 'contain' : 'cover';
};

export const getNextHistoryPhotoGridFitMode = (
  fitMode: HistoryPhotoGridFitMode
): HistoryPhotoGridFitMode => fitMode === 'cover' ? 'contain' : 'cover';

export const clampHistoryPhotoGridOffset = (value: number, limit = 60): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
};

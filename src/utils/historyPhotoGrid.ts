export interface HistoryPhotoGridImageSize {
  width: number;
  height: number;
}

export interface HistoryPhotoGridCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface HistoryPhotoGridDisplaySize {
  width: number;
  height: number;
}

export const HISTORY_PHOTO_GRID_MIN_ZOOM = 1;
export const HISTORY_PHOTO_GRID_MAX_ZOOM = 2;

const isValidSize = (size: HistoryPhotoGridImageSize): boolean => size.width > 0 && size.height > 0;

export const getHistoryPhotoGridBaseSize = (
  size: HistoryPhotoGridImageSize
): HistoryPhotoGridDisplaySize => {
  if (!isValidSize(size)) return { width: 1, height: 1 };

  const aspect = size.width / size.height;
  return aspect >= 1
    ? { width: 1, height: 1 / aspect }
    : { width: aspect, height: 1 };
};

export const clampHistoryPhotoGridZoom = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return HISTORY_PHOTO_GRID_MIN_ZOOM;
  return Math.max(HISTORY_PHOTO_GRID_MIN_ZOOM, Math.min(HISTORY_PHOTO_GRID_MAX_ZOOM, zoom));
};

export const getHistoryPhotoGridDisplaySize = (
  size: HistoryPhotoGridImageSize,
  zoom: number
): HistoryPhotoGridDisplaySize => {
  const base = getHistoryPhotoGridBaseSize(size);
  const clampedZoom = clampHistoryPhotoGridZoom(zoom);
  return {
    width: base.width * clampedZoom,
    height: base.height * clampedZoom
  };
};

export const getTopAlignedHistoryPhotoGridOffsetY = (
  size: HistoryPhotoGridImageSize,
  zoom: number
): number => {
  const display = getHistoryPhotoGridDisplaySize(size, zoom);
  return display.height / 2 - 0.5;
};

export const getInitialHistoryPhotoGridCrop = (
  size: HistoryPhotoGridImageSize
): HistoryPhotoGridCrop => {
  return {
    zoom: HISTORY_PHOTO_GRID_MIN_ZOOM,
    offsetX: 0,
    offsetY: getTopAlignedHistoryPhotoGridOffsetY(size, HISTORY_PHOTO_GRID_MIN_ZOOM)
  };
};

export const clampHistoryPhotoGridCrop = (
  size: HistoryPhotoGridImageSize,
  crop: HistoryPhotoGridCrop
): HistoryPhotoGridCrop => {
  const zoom = clampHistoryPhotoGridZoom(crop.zoom);
  const display = getHistoryPhotoGridDisplaySize(size, zoom);
  const maxOffsetX = display.width / 2;
  const maxOffsetY = display.height / 2;

  return {
    zoom,
    offsetX: clampOffset(crop.offsetX, maxOffsetX),
    offsetY: clampOffset(crop.offsetY, maxOffsetY)
  };
};

const clampOffset = (value: number, limit: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
};

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
export const HISTORY_PHOTO_GRID_MIN_FRAME_ASPECT = 1;
export const HISTORY_PHOTO_GRID_MAX_FRAME_ASPECT = 2;

const isValidSize = (size: HistoryPhotoGridImageSize): boolean => size.width > 0 && size.height > 0;

export const getHistoryPhotoGridFrameAspect = (size: HistoryPhotoGridImageSize): number => {
  if (!isValidSize(size)) return HISTORY_PHOTO_GRID_MIN_FRAME_ASPECT;
  const aspect = size.width / size.height;
  if (!Number.isFinite(aspect)) return HISTORY_PHOTO_GRID_MIN_FRAME_ASPECT;
  return Math.max(
    HISTORY_PHOTO_GRID_MIN_FRAME_ASPECT,
    Math.min(HISTORY_PHOTO_GRID_MAX_FRAME_ASPECT, aspect)
  );
};

export const getHistoryPhotoGridBaseSize = (
  size: HistoryPhotoGridImageSize,
  frameAspect = 1
): HistoryPhotoGridDisplaySize => {
  if (!isValidSize(size) || frameAspect <= 0) return { width: 1, height: 1 };

  const aspect = size.width / size.height;
  return aspect >= frameAspect
    ? { width: 1, height: frameAspect / aspect }
    : { width: aspect / frameAspect, height: 1 };
};

export const clampHistoryPhotoGridZoom = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return HISTORY_PHOTO_GRID_MIN_ZOOM;
  return Math.max(HISTORY_PHOTO_GRID_MIN_ZOOM, Math.min(HISTORY_PHOTO_GRID_MAX_ZOOM, zoom));
};

export const getHistoryPhotoGridDisplaySize = (
  size: HistoryPhotoGridImageSize,
  zoom: number,
  frameAspect = 1
): HistoryPhotoGridDisplaySize => {
  const base = getHistoryPhotoGridBaseSize(size, frameAspect);
  const clampedZoom = clampHistoryPhotoGridZoom(zoom);
  return {
    width: base.width * clampedZoom,
    height: base.height * clampedZoom
  };
};

export const getTopAlignedHistoryPhotoGridOffsetY = (
  size: HistoryPhotoGridImageSize,
  zoom: number,
  frameAspect = 1
): number => {
  const display = getHistoryPhotoGridDisplaySize(size, zoom, frameAspect);
  return display.height / 2 - 0.5;
};

export const getInitialHistoryPhotoGridCrop = (
  size: HistoryPhotoGridImageSize,
  frameAspect = 1
): HistoryPhotoGridCrop => {
  return {
    zoom: HISTORY_PHOTO_GRID_MIN_ZOOM,
    offsetX: 0,
    offsetY: getTopAlignedHistoryPhotoGridOffsetY(size, HISTORY_PHOTO_GRID_MIN_ZOOM, frameAspect)
  };
};

export const clampHistoryPhotoGridCrop = (
  size: HistoryPhotoGridImageSize,
  crop: HistoryPhotoGridCrop,
  frameAspect = 1
): HistoryPhotoGridCrop => {
  const zoom = clampHistoryPhotoGridZoom(crop.zoom);
  const display = getHistoryPhotoGridDisplaySize(size, zoom, frameAspect);
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

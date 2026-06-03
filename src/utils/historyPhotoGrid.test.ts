import { describe, expect, it } from 'vitest';
import {
  clampHistoryPhotoGridCrop,
  clampHistoryPhotoGridZoom,
  getHistoryPhotoGridBaseSize,
  getHistoryPhotoGridDisplaySize,
  getInitialHistoryPhotoGridCrop,
  getTopAlignedHistoryPhotoGridOffsetY
} from './historyPhotoGrid';

describe('historyPhotoGrid', () => {
  it('fits landscape photos fully inside the crop frame at minimum zoom', () => {
    expect(getHistoryPhotoGridBaseSize({ width: 1600, height: 800 })).toEqual({
      width: 1,
      height: 0.5
    });
  });

  it('fits portrait photos fully inside the crop frame at minimum zoom', () => {
    expect(getHistoryPhotoGridBaseSize({ width: 800, height: 1600 })).toEqual({
      width: 0.5,
      height: 1
    });
  });

  it('top-aligns the initial crop when the image leaves bottom whitespace', () => {
    expect(getInitialHistoryPhotoGridCrop({ width: 1600, height: 800 })).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: -0.25
    });
  });

  it('keeps zoomed landscape images top-aligned', () => {
    expect(getTopAlignedHistoryPhotoGridOffsetY({ width: 1600, height: 800 }, 2)).toBe(0);
  });

  it('limits zoom to the editable range', () => {
    expect(clampHistoryPhotoGridZoom(0.4)).toBe(1);
    expect(clampHistoryPhotoGridZoom(1.5)).toBe(1.5);
    expect(clampHistoryPhotoGridZoom(3)).toBe(2);
  });

  it('calculates display size from minimum-fit zoom', () => {
    expect(getHistoryPhotoGridDisplaySize({ width: 1600, height: 800 }, 2)).toEqual({
      width: 2,
      height: 1
    });
  });

  it('clamps panning so image corners do not pass the crop center', () => {
    expect(clampHistoryPhotoGridCrop(
      { width: 1600, height: 800 },
      { zoom: 2, offsetX: 3, offsetY: -3 }
    )).toEqual({
      zoom: 2,
      offsetX: 1,
      offsetY: -0.5
    });
  });
});

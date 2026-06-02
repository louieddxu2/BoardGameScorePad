import { describe, expect, it } from 'vitest';
import {
  clampHistoryPhotoGridOffset,
  getDefaultHistoryPhotoGridFitMode,
  getNextHistoryPhotoGridFitMode
} from './historyPhotoGrid';

describe('historyPhotoGrid', () => {
  it('defaults landscape photos to contain mode', () => {
    expect(getDefaultHistoryPhotoGridFitMode(1600, 900)).toBe('contain');
  });

  it('defaults square and portrait photos to cover mode', () => {
    expect(getDefaultHistoryPhotoGridFitMode(1000, 1000)).toBe('cover');
    expect(getDefaultHistoryPhotoGridFitMode(900, 1600)).toBe('cover');
  });

  it('cycles fit modes', () => {
    expect(getNextHistoryPhotoGridFitMode('cover')).toBe('contain');
    expect(getNextHistoryPhotoGridFitMode('contain')).toBe('cover');
  });

  it('clamps pan offsets', () => {
    expect(clampHistoryPhotoGridOffset(90)).toBe(60);
    expect(clampHistoryPhotoGridOffset(-90)).toBe(-60);
    expect(clampHistoryPhotoGridOffset(12)).toBe(12);
    expect(clampHistoryPhotoGridOffset(Number.NaN)).toBe(0);
  });
});

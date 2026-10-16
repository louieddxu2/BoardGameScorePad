import { getRelativeLuminance } from './ui';

/** Blur-free outlines survive image export and protect every edge of a glyph. */
export const getPhotoTextOutline = (color: string, softShadow: string, width = 2): string => [
    `-${width}px -${width}px 0 ${color}`, `0 -${width}px 0 ${color}`, `${width}px -${width}px 0 ${color}`,
    `-${width}px 0 0 ${color}`, `${width}px 0 0 ${color}`,
    `-${width}px ${width}px 0 ${color}`, `0 ${width}px 0 ${color}`, `${width}px ${width}px 0 ${color}`,
    softShadow,
].join(', ');

/** Preserve the player's fill color, with a legible edge even on a similarly colored card. */
const getPhotoPlayerOutlineColor = (color: string): string => {
    const luminance = getRelativeLuminance(color);
    const whiteContrast = 1.05 / (luminance + 0.05);
    const blackContrast = (luminance + 0.05) / 0.05;
    return whiteContrast > blackContrast ? '#ffffff' : '#000000';
};

export const getPhotoPlayerNameShadow = (color: string): string =>
    getPhotoTextOutline(getPhotoPlayerOutlineColor(color), '0 2px 3px rgba(0,0,0,0.25)', 1.25);

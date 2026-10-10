import type { PhotoQuarterTurns } from '../types';

/** Render from the original blob, never from a previously encoded rotation. */
export const rotatePhotoBlob = async (source: Blob, quarterTurns: PhotoQuarterTurns): Promise<Blob> => {
  if (quarterTurns === 0) return source;
  const sourceUrl = URL.createObjectURL(source);
  const image = new Image();
  let canvas: HTMLCanvasElement | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Photo could not be decoded'));
      image.src = sourceUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Photo has no dimensions');
    canvas = document.createElement('canvas');
    const swapAxes = quarterTurns % 2 === 1;
    canvas.width = swapAxes ? image.naturalHeight : image.naturalWidth;
    canvas.height = swapAxes ? image.naturalWidth : image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(quarterTurns * Math.PI / 2);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const mimeType = source.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob(blob => blob ? resolve(blob) : reject(new Error('Photo rotation failed')), mimeType, 0.95);
    });
  } finally {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(sourceUrl);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
};

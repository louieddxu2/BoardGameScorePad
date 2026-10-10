import { useEffect, useRef, useState, type RefObject } from 'react';
import { toBlob } from 'html-to-image';
import type { OverlayData } from '../parts/ScoreOverlayGenerator';

interface Composition {
  imageSrc: string;
  data: OverlayData;
  url: string;
}

/** A composed score photo belongs to one source/data pair, not to the viewer. */
export const usePhotoComposition = (
  enabled: boolean,
  imageSrc: string,
  data: OverlayData | undefined,
  generatorRef: RefObject<HTMLDivElement>,
  onError: () => void,
) => {
  const [result, setResult] = useState<Composition | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!enabled || !data) { setResult(null); return; }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        if (!generatorRef.current) throw new Error('Photo generator is unavailable');
        const blob = await toBlob(generatorRef.current, {
          pixelRatio: 1,
          backgroundColor: 'rgb(var(--c-app-bg))',
          skipFonts: true,
        });
        if (!active) return;
        if (!blob) throw new Error('Blob generation returned null');
        setResult({ imageSrc, data, url: URL.createObjectURL(blob) });
      } catch (error) {
        if (!active) return;
        console.error('Overlay generation failed', error);
        onErrorRef.current();
      }
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [enabled, imageSrc, data, generatorRef]);

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const current = enabled && result?.imageSrc === imageSrc && result.data === data;
  return {
    composedImageUrl: current ? result.url : null,
    isGenerating: !!(enabled && data && !current),
  };
};

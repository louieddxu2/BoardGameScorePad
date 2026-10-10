import { useEffect, useRef, useState } from 'react';
import type { LocalImage, PhotoQuarterTurns, PhotoContentIds } from '../types';
import { imageService } from '../services/imageService';
import { rotatePhotoBlob } from '../utils/photoRotation';
import { generateId } from '../utils/idGenerator';

export interface LoadedPhoto {
  id: string;
  url: string;
  contentId?: string;
}

/** View the stored image bytes directly; revisions only invalidate changed URLs. */
export const usePhotoImages = (photoIds: string[], contentIds?: PhotoContentIds, isOpen = true) => {
  const [images, setImages] = useState<LoadedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, LoadedPhoto>());
  const sources = useRef(new Map<string, LocalImage>());
  const urls = useRef(new Set<string>());
  const generation = useRef(0);
  const rotating = useRef(false);
  const releaseUrl = (url: string) => {
    if (urls.current.delete(url)) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let active = true;
    const currentGeneration = ++generation.current;
    if (!isOpen) {
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current.clear();
      cache.current.clear();
      sources.current.clear();
      setImages([]);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const loaded: LoadedPhoto[] = [];
      for (const id of [...photoIds].reverse()) {
        if (!active) return;
        const contentId = contentIds?.[id];
        const cached = cache.current.get(id);
        if (cached && cached.contentId === contentId) { loaded.push(cached); continue; }
        try {
          const source = await imageService.getImage(id);
          if (!active) return;
          if (!source) continue;
          sources.current.set(id, source);
          const url = URL.createObjectURL(source.blob);
          urls.current.add(url);
          const image = { id, url, contentId: source.contentId };
          cache.current.set(id, image);
          loaded.push(image);
        } catch (error) {
          console.error(`Failed to load photo ${id}`, error);
        }
      }
      if (!active || currentGeneration !== generation.current) return;
      const wanted = new Set(photoIds);
      for (const id of cache.current.keys()) {
        if (!wanted.has(id)) { cache.current.delete(id); sources.current.delete(id); }
      }
      setImages(loaded);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [isOpen, photoIds, contentIds]);

  useEffect(() => {
    const retained = new Set([...images.map(image => image.url), ...Array.from(cache.current.values(), image => image.url)]);
    for (const url of urls.current) if (!retained.has(url)) releaseUrl(url);
  }, [images]);

  useEffect(() => () => {
    generation.current += 1;
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
    cache.current.clear();
    sources.current.clear();
  }, []);

  const rotatePhoto = async (
    id: string,
    onSave: (image: LocalImage, expectedContentId?: string) => Promise<void>,
  ) => {
    if (rotating.current) return;
    const previous = cache.current.get(id);
    const source = sources.current.get(id);
    if (!previous || !source) return;
    rotating.current = true;
    const startedGeneration = generation.current;
    let next: LoadedPhoto | undefined;
    try {
      const original = source.rotationSource?.blob || source.blob;
      const quarterTurns = (((source.rotationSource?.quarterTurns || 0) + 1) % 4) as PhotoQuarterTurns;
      const blob = await rotatePhotoBlob(original, quarterTurns);
      if (startedGeneration !== generation.current) return;
      const updated: LocalImage = {
        ...source,
        blob,
        mimeType: blob.type,
        contentId: generateId(),
        isSynced: false,
        rotationSource: quarterTurns ? { blob: original, quarterTurns } : undefined,
      };
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      next = { id, url, contentId: updated.contentId };
      // Reserve the new bytes before notifying the owner. Its revision update
      // must reuse this URL, not reload the whole album.
      cache.current.set(id, next);
      sources.current.set(id, updated);
      await onSave(updated, source.contentId);
      if (!urls.current.has(url)) return; // Closed/unmounted while saving.
      setImages(current => current.map(image => image.id === id ? next! : image));
    } catch (error) {
      if (next && cache.current.get(id) === next) {
        cache.current.set(id, previous);
        sources.current.set(id, source);
      }
      if (next) releaseUrl(next.url);
      throw error;
    } finally {
      rotating.current = false;
    }
  };

  return { images, loading, rotatePhoto };
};

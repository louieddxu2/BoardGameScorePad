import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Image as ImageIcon, Loader2, Share2, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { selectHistoryPhotoGridItems } from '../../utils/historyStats';
import {
  clampHistoryPhotoGridCrop,
  getHistoryPhotoGridBaseSize,
  getInitialHistoryPhotoGridCrop,
  getTopAlignedHistoryPhotoGridOffsetY,
  HistoryPhotoGridCrop,
  HistoryPhotoGridImageSize
} from '../../utils/historyPhotoGrid';
import { getTouchDistance } from '../../utils/ui';
import { imageService } from '../../services/imageService';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { useToast } from '../../hooks/useToast';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';

interface LoadedGridPhoto {
  id: string;
  recordId: string;
  gameKey: string;
  gameName: string;
  endTime: number;
  url: string;
  imageSize: HistoryPhotoGridImageSize;
}

interface EditableGridTile extends LoadedGridPhoto {
  crop: HistoryPhotoGridCrop;
}

interface CropDraft extends EditableGridTile {
  tileIndex: number;
}

interface HistoryPhotoGridShareModalProps {
  isOpen: boolean;
  entries: HistoryGameEntry[];
  onClose: () => void;
}

const EXPORT_GRID_WIDTH = 520;
const PHOTO_GRID_IMAGE_FRAME_ASPECT = 4 / 3;

const HistoryPhotoGridShareModal: React.FC<HistoryPhotoGridShareModalProps> = ({ isOpen, entries, onClose }) => {
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'history-photo-grid-share');
  const { showToast } = useToast();
  const { t } = useHistoryStatsTranslation();
  const exportRef = useRef<HTMLDivElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const cropEditorSurfaceRef = useRef<HTMLDivElement>(null);
  const [photoPool, setPhotoPool] = useState<LoadedGridPhoto[]>([]);
  const [tiles, setTiles] = useState<EditableGridTile[]>([]);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  useModalBackHandler(!!cropDraft, () => setCropDraft(null), 'history-photo-grid-crop');
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const gridItems = useMemo(() => selectHistoryPhotoGridItems(entries, Number.MAX_SAFE_INTEGER), [entries]);

  const stopCropGestureEvent = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    nativeEvent?: { stopPropagation?: () => void };
  }) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopPropagation?.();
  };

  useEffect(() => {
    if (!isOpen) {
      photoPool.forEach(photo => URL.revokeObjectURL(photo.url));
      setPhotoPool([]);
      setTiles([]);
      setCropDraft(null);
      return;
    }

    let active = true;
    const generatedUrls: string[] = [];

    const loadImages = async () => {
      setIsLoading(true);
      const loadedById = new Map<string, LoadedGridPhoto>();

      for (const item of gridItems) {
        for (const candidate of item.candidatePhotos) {
          if (loadedById.has(candidate.photoId)) continue;

          try {
            const localImage = await imageService.getImage(candidate.photoId);
            if (!localImage || !active) continue;

            const url = URL.createObjectURL(localImage.blob);
            generatedUrls.push(url);
            const imageSize = await getImageSize(url);
            loadedById.set(candidate.photoId, {
              id: candidate.photoId,
              recordId: candidate.recordId,
              gameKey: item.gameKey,
              gameName: item.gameName,
              endTime: candidate.endTime,
              url,
              imageSize
            });
          } catch (error) {
            console.warn('Failed to load history grid image', error);
          }
        }
      }

      if (active) {
        const loaded = Array.from(loadedById.values());
        setPhotoPool(loaded);
        setTiles(gridItems.slice(0, 9).flatMap(item => {
          const photo = loadedById.get(item.photoId);
          return photo ? [createTileFromPhoto(photo)] : [];
        }));
        setCropDraft(null);
        setIsLoading(false);
      } else {
        generatedUrls.forEach(url => URL.revokeObjectURL(url));
      }
    };

    loadImages();

    return () => {
      active = false;
      generatedUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [isOpen, gridItems]);

  useEffect(() => {
    if (!cropDraft) return;

    const preventGestureDefault = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    window.addEventListener('gesturestart', preventGestureDefault);
    window.addEventListener('gesturechange', preventGestureDefault);
    window.addEventListener('gestureend', preventGestureDefault);

    return () => {
      window.removeEventListener('gesturestart', preventGestureDefault);
      window.removeEventListener('gesturechange', preventGestureDefault);
      window.removeEventListener('gestureend', preventGestureDefault);
    };
  }, [cropDraft]);

  const openCropEditor = (tileIndex: number) => {
    const tile = tiles[tileIndex];
    if (!tile) return;
    setCropDraft({ ...tile, crop: { ...tile.crop }, tileIndex });
  };

  const updateDraftCrop = (nextCrop: HistoryPhotoGridCrop) => {
    setCropDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        crop: clampHistoryPhotoGridCrop(prev.imageSize, nextCrop, PHOTO_GRID_IMAGE_FRAME_ASPECT)
      };
    });
  };

  const replaceDraftPhoto = (photo: LoadedGridPhoto) => {
    setCropDraft(prev => {
      if (!prev) return prev;
      return {
        ...createTileFromPhoto(photo),
        tileIndex: prev.tileIndex
      };
    });
  };

  const confirmCrop = () => {
    if (!cropDraft) return;
    setTiles(prev => prev.map((tile, index) => index === cropDraft.tileIndex ? toTile(cropDraft) : tile));
    setCropDraft(null);
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!cropDraft) return;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      offsetX: cropDraft.crop.offsetX,
      offsetY: cropDraft.crop.offsetY
    };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!cropDraft || !dragRef.current || !cropFrameRef.current) return;
    const frameRect = cropFrameRef.current.getBoundingClientRect();
    const dx = (clientX - dragRef.current.startX) / (frameRect.width || 1);
    const dy = (clientY - dragRef.current.startY) / (frameRect.height || 1);
    updateDraftCrop({
      ...cropDraft.crop,
      offsetX: dragRef.current.offsetX + dx,
      offsetY: dragRef.current.offsetY + dy
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    handleDragStart(event.clientX, event.clientY);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    handleDragMove(event.clientX, event.clientY);
  };

  const stopEditingGesture = () => {
    dragRef.current = null;
    pinchRef.current = null;
  };

  const handleMouseEnd = (event: React.MouseEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    stopEditingGesture();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    if (!cropDraft) return;

    if (event.touches.length === 2) {
      pinchRef.current = {
        distance: getTouchDistance(event.touches),
        zoom: cropDraft.crop.zoom
      };
      dragRef.current = null;
      return;
    }

    handleDragStart(event.touches[0].clientX, event.touches[0].clientY);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    if (!cropDraft) return;

    if (event.touches.length === 2 && pinchRef.current) {
      const distance = getTouchDistance(event.touches);
      const zoom = pinchRef.current.zoom * (distance / pinchRef.current.distance);
      updateDraftCrop({
        ...cropDraft.crop,
        zoom
      });
      return;
    }

    if (event.touches.length === 1) {
      handleDragMove(event.touches[0].clientX, event.touches[0].clientY);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    stopEditingGesture();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    stopCropGestureEvent(event);
    if (!cropDraft) return;
    const zoom = cropDraft.crop.zoom * (1 - event.deltaY * 0.001);
    updateDraftCrop({
      ...cropDraft.crop,
      zoom
    });
  };

  const handleExport = async () => {
    if (!exportRef.current || tiles.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await toBlob(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: 'rgb(var(--c-app-bg))',
        skipFonts: true
      });
      if (!blob) throw new Error('Failed to generate image');

      const fileName = `history_grid_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: t('grid_share_title') });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast({ message: t('grid_download_success'), type: 'success' });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('History grid export failed', error);
        showToast({ message: t('grid_export_failed'), type: 'error' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const cropPhotoOptions = cropDraft
    ? photoPool.filter(photo => photo.gameKey === cropDraft.gameKey)
    : [];

  return (
    <div className="fixed inset-0 bg-app-bg-deep/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200" style={{ zIndex }}>
      <div className="flex-none h-16 px-4 border-b border-surface-border bg-modal-bg flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
            <ImageIcon size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-txt-title truncate">{t('grid_modal_title')}</h3>
            <p className="text-[11px] text-txt-muted">{cropDraft ? t('grid_crop_hint') : t('grid_modal_subtitle')}</p>
          </div>
        </div>
        <button onClick={() => cropDraft ? setCropDraft(null) : onClose()} className="p-2 rounded-full bg-modal-bg-elevated text-txt-secondary hover:text-txt-title transition-colors">
          <X size={20} />
        </button>
      </div>

      {cropDraft ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            ref={cropEditorSurfaceRef}
            className="flex-1 min-h-0 flex items-center justify-center p-4 bg-app-bg-deep touch-none overscroll-none overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseEnd}
            onMouseLeave={handleMouseEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onWheel={handleWheel}
            data-mobile-zoom-ignore="true"
            style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
          >
            <div ref={cropFrameRef} className="relative w-[min(86vw,64vh)] max-w-[560px] aspect-[4/3] rounded-xl overflow-visible">
              <PhotoImage tile={cropDraft} />
              <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-brand-primary shadow-[0_0_0_9999px_rgba(15,23,42,0.34)] ring-1 ring-white/50" />
            </div>
          </div>

          <div className="flex-none border-t border-surface-border bg-modal-bg p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar flex items-center gap-2">
              {cropPhotoOptions.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => replaceDraftPhoto(photo)}
                  className={`w-20 h-14 rounded-lg overflow-hidden border shrink-0 ${cropDraft.id === photo.id ? 'border-brand-primary' : 'border-surface-border'}`}
                  title={photo.gameName}
                >
                  <img src={photo.url} alt={photo.gameName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <button
              onClick={confirmCrop}
              className="shrink-0 h-12 px-4 rounded-xl bg-brand-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Check size={18} />
              {t('grid_confirm_crop')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-txt-muted">
                <Loader2 size={32} className="animate-spin text-brand-primary" />
                <span className="text-sm font-bold">{t('grid_loading')}</span>
              </div>
            ) : tiles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-txt-muted text-center">
                <div className="w-16 h-16 rounded-full bg-surface-recessed flex items-center justify-center">
                  <ImageIcon size={30} className="opacity-60" />
                </div>
                <div>
                  <p className="text-sm font-bold text-txt-secondary">{t('grid_empty_title')}</p>
                  <p className="text-xs mt-1 opacity-70">{t('grid_empty_desc')}</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[520px]">
                <PhotoGridCanvas tiles={tiles} onSelect={openCropEditor} />
                <div className="absolute left-[-10000px] top-0 pointer-events-none" style={{ width: EXPORT_GRID_WIDTH }}>
                  <PhotoGridCanvas ref={exportRef} tiles={tiles} />
                </div>
              </div>
            )}
          </div>

          <div className="flex-none h-20 px-4 border-t border-surface-border bg-modal-bg flex items-center justify-end">
            <button
              onClick={handleExport}
              disabled={tiles.length === 0 || isExporting}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold text-sm disabled:bg-surface-bg disabled:text-txt-muted disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : (typeof navigator.share === 'function' ? <Share2 size={18} /> : <Download size={18} />)}
              {isExporting ? t('grid_exporting') : t('grid_share_button')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const getImageSize = (url: string): Promise<HistoryPhotoGridImageSize> => {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = url;
  });
};

const formatGridDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
};

const createTileFromPhoto = (photo: LoadedGridPhoto): EditableGridTile => ({
  ...photo,
  crop: getInitialHistoryPhotoGridCrop(photo.imageSize, PHOTO_GRID_IMAGE_FRAME_ASPECT)
});

const toTile = (draft: CropDraft): EditableGridTile => ({
  id: draft.id,
  recordId: draft.recordId,
  gameKey: draft.gameKey,
  gameName: draft.gameName,
  endTime: draft.endTime,
  url: draft.url,
  imageSize: draft.imageSize,
  crop: draft.crop
});

interface PhotoGridCanvasProps {
  tiles: EditableGridTile[];
  onSelect?: (index: number) => void;
}

const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({ tiles, onSelect }, ref) => (
  <div ref={ref} className="w-full aspect-square bg-app-bg p-2 grid grid-cols-3 gap-1 rounded-xl border border-surface-border shadow-2xl">
    {Array.from({ length: 9 }).map((_, index) => {
      const tile = tiles[index];
      return (
        <button
          key={`${tile?.id || 'empty'}-${index}`}
          onClick={() => tile && onSelect?.(index)}
          disabled={!tile || !onSelect}
          className="bg-surface-recessed rounded-md overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform flex flex-col"
        >
          {tile ? (
            <PhotoTile tile={tile} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-txt-muted/40">
              <ImageIcon size={22} />
            </div>
          )}
        </button>
      );
    })}
  </div>
));

PhotoGridCanvas.displayName = 'PhotoGridCanvas';

const PhotoImage: React.FC<{ tile: EditableGridTile }> = ({ tile }) => {
  const base = getHistoryPhotoGridBaseSize(tile.imageSize, PHOTO_GRID_IMAGE_FRAME_ASPECT);
  return (
    <img
      src={tile.url}
      alt={tile.gameName}
      draggable={false}
      className="absolute select-none max-w-none max-h-none"
      style={{
        left: `${50 + tile.crop.offsetX * 100}%`,
        top: `${50 + tile.crop.offsetY * 100}%`,
        width: `${base.width * 100}%`,
        height: `${base.height * 100}%`,
        transform: `translate(-50%, -50%) scale(${tile.crop.zoom})`,
        transformOrigin: 'center center'
      }}
    />
  );
};

const PhotoTile: React.FC<{ tile: EditableGridTile }> = ({ tile }) => {
  return (
    <>
      <div className="relative flex-1 min-h-0 overflow-hidden bg-app-bg-deep">
        <PhotoImage tile={tile} />
      </div>
      <div className="flex-none h-[26%] min-h-[24px] px-1.5 py-1 bg-app-bg-deep text-white flex flex-col justify-center">
        <span className="text-[10px] leading-tight font-bold truncate">{tile.gameName}</span>
        <span className="text-[8px] leading-tight text-white/60 font-mono">{formatGridDate(tile.endTime)}</span>
      </div>
    </>
  );
};

export default HistoryPhotoGridShareModal;

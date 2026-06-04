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
  gameName: string;
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
      const loaded: LoadedGridPhoto[] = [];

      for (const item of gridItems) {
        try {
          const localImage = await imageService.getImage(item.photoId);
          if (!localImage || !active) continue;

          const url = URL.createObjectURL(localImage.blob);
          generatedUrls.push(url);
          const imageSize = await getImageSize(url);
          loaded.push({ id: item.photoId, gameName: item.gameName, url, imageSize });
        } catch (error) {
          console.warn('Failed to load history grid image', error);
        }
      }

      if (active) {
        setPhotoPool(loaded);
        setTiles(loaded.slice(0, 9).map(createTileFromPhoto));
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
    const surface = cropEditorSurfaceRef.current;
    if (!cropDraft || !surface) return;

    const preventGestureDefault = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    };

    surface.addEventListener('touchmove', preventGestureDefault, { passive: false });
    surface.addEventListener('gesturestart', preventGestureDefault);
    surface.addEventListener('gesturechange', preventGestureDefault);
    surface.addEventListener('gestureend', preventGestureDefault);

    return () => {
      surface.removeEventListener('touchmove', preventGestureDefault);
      surface.removeEventListener('gesturestart', preventGestureDefault);
      surface.removeEventListener('gesturechange', preventGestureDefault);
      surface.removeEventListener('gestureend', preventGestureDefault);
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
        crop: clampHistoryPhotoGridCrop(prev.imageSize, nextCrop)
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
    const frameSize = cropFrameRef.current.getBoundingClientRect().width || 1;
    const dx = (clientX - dragRef.current.startX) / frameSize;
    const dy = (clientY - dragRef.current.startY) / frameSize;
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
            style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
          >
            <div ref={cropFrameRef} className="relative w-[min(82vw,54vh)] max-w-[520px] aspect-square rounded-xl overflow-visible">
              <PhotoImage tile={cropDraft} />
              <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-brand-primary shadow-[0_0_0_9999px_rgba(15,23,42,0.34)] ring-1 ring-white/50" />
            </div>
          </div>

          <div className="flex-none border-t border-surface-border bg-modal-bg p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar flex items-center gap-2">
              {photoPool.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => replaceDraftPhoto(photo)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border shrink-0 ${cropDraft.id === photo.id ? 'border-brand-primary' : 'border-surface-border'}`}
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

const createTileFromPhoto = (photo: LoadedGridPhoto): EditableGridTile => ({
  ...photo,
  crop: getInitialHistoryPhotoGridCrop(photo.imageSize)
});

const toTile = (draft: CropDraft): EditableGridTile => ({
  id: draft.id,
  gameName: draft.gameName,
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
          className="relative bg-surface-recessed rounded-md overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform"
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
  const base = getHistoryPhotoGridBaseSize(tile.imageSize);
  const isLandscape = tile.imageSize.width >= tile.imageSize.height;
  return (
    <img
      src={tile.url}
      alt={tile.gameName}
      draggable={false}
      className="absolute select-none max-w-none max-h-none"
      style={{
        left: `${50 + tile.crop.offsetX * 100}%`,
        top: `${50 + tile.crop.offsetY * 100}%`,
        width: isLandscape ? `${base.width * 100}%` : 'auto',
        height: isLandscape ? 'auto' : `${base.height * 100}%`,
        transform: `translate(-50%, -50%) scale(${tile.crop.zoom})`,
        transformOrigin: 'center center'
      }}
    />
  );
};

const PhotoTile: React.FC<{ tile: EditableGridTile }> = ({ tile }) => {
  return (
    <>
      <PhotoImage tile={tile} />
      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-app-bg-deep text-white text-[10px] font-bold truncate">
        {tile.gameName}
      </div>
    </>
  );
};

export default HistoryPhotoGridShareModal;

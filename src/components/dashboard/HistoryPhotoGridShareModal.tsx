import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Image as ImageIcon, Loader2, Share2, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { buildHistoryStats, selectHistoryPhotoGridItems } from '../../utils/historyStats';
import {
  clampHistoryPhotoGridCrop,
  getHistoryPhotoGridBaseSize,
  getInitialHistoryPhotoGridCrop,
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

const EXPORT_GRID_WIDTH = 1080;
const PHOTO_RECAP_TILE_COUNT = 8;
const PHOTO_RECAP_TILE_ASPECT = 16 / 9;
const getTileFrameAspect = (tile: Pick<EditableGridTile, 'imageSize'>): number => (
  PHOTO_RECAP_TILE_ASPECT
);

const HistoryPhotoGridShareModal: React.FC<HistoryPhotoGridShareModalProps> = ({ isOpen, entries, onClose }) => {
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'history-photo-grid-share');
  const { showToast } = useToast();
  const { t } = useHistoryStatsTranslation();
  const exportRef = useRef<HTMLDivElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const cropEditorSurfaceRef = useRef<HTMLDivElement>(null);
  const loadedPhotosRef = useRef<Map<string, LoadedGridPhoto>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);
  const loadGenerationRef = useRef(0);
  const [photoPool, setPhotoPool] = useState<LoadedGridPhoto[]>([]);
  const [tiles, setTiles] = useState<EditableGridTile[]>([]);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  useModalBackHandler(!!cropDraft, () => setCropDraft(null), 'history-photo-grid-crop');
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const gridItems = useMemo(() => selectHistoryPhotoGridItems(entries, PHOTO_RECAP_TILE_COUNT), [entries]);
  const stats = useMemo(() => buildHistoryStats(entries), [entries]);
  const gridItemByGameKey = useMemo(() => (
    new Map(gridItems.map(item => [item.gameKey, item]))
  ), [gridItems]);

  const stopCropGestureEvent = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    nativeEvent?: { stopPropagation?: () => void };
  }) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopPropagation?.();
  };

  const cleanupLoadedPhotos = () => {
    loadGenerationRef.current += 1;
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    loadedPhotosRef.current.clear();
  };

  const loadGridPhoto = async (
    item: ReturnType<typeof selectHistoryPhotoGridItems>[number],
    photoId: string
  ): Promise<LoadedGridPhoto | null> => {
    const generation = loadGenerationRef.current;
    const existing = loadedPhotosRef.current.get(photoId);
    if (existing) return existing;

    const candidate = item.candidatePhotos.find(photo => photo.photoId === photoId);
    if (!candidate) return null;

    try {
      const localImage = await imageService.getImage(photoId);
      if (!localImage) return null;

      const url = URL.createObjectURL(localImage.blob);
      objectUrlsRef.current.push(url);
      const imageSize = await getImageSize(url);
      if (generation !== loadGenerationRef.current) {
        URL.revokeObjectURL(url);
        return null;
      }

      const loadedPhoto: LoadedGridPhoto = {
        id: photoId,
        recordId: candidate.recordId,
        gameKey: item.gameKey,
        gameName: item.gameName,
        endTime: candidate.endTime,
        url,
        imageSize
      };

      loadedPhotosRef.current.set(photoId, loadedPhoto);
      setPhotoPool(Array.from(loadedPhotosRef.current.values()));
      return loadedPhoto;
    } catch (error) {
      console.warn('Failed to load history grid image', error);
      return null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupLoadedPhotos();
      setPhotoPool([]);
      setTiles([]);
      setCropDraft(null);
      return;
    }

    let active = true;

    const loadImages = async () => {
      cleanupLoadedPhotos();
      setPhotoPool([]);
      setTiles([]);
      setCropDraft(null);
      setIsLoading(true);

      if (gridItems.length === 0) {
        setIsLoading(false);
        return;
      }

      await Promise.all(gridItems.map(async (item, index) => {
        const photo = await loadGridPhoto(item, item.photoId);
        if (!photo || !active) return;

        setTiles(prev => {
          const next = [...prev];
          next[index] = createTileFromPhoto(photo);
          return next;
        });
      }));

      if (active) setIsLoading(false);
    };

    loadImages();

    return () => {
      active = false;
      cleanupLoadedPhotos();
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

    const item = gridItemByGameKey.get(tile.gameKey);
    if (!item) return;

    item.candidatePhotos.forEach(candidate => {
      if (candidate.photoId === tile.id) return;
      void loadGridPhoto(item, candidate.photoId);
    });
  };

  const updateDraftCrop = (nextCrop: HistoryPhotoGridCrop) => {
    setCropDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        crop: clampHistoryPhotoGridCrop(prev.imageSize, nextCrop, getTileFrameAspect(prev))
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
  const statLabels = {
    plays: t('stats_count_label'),
    games: t('stats_games_label'),
    players: t('stats_players_label')
  };

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
            <div
              ref={cropFrameRef}
              className="relative max-w-[560px] rounded-xl overflow-visible"
              style={getCropFrameStyle(cropDraft)}
            >
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
            {isLoading && tiles.length === 0 ? (
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
                <PhotoGridCanvas tiles={tiles} stats={stats} labels={statLabels} onSelect={openCropEditor} />
                <div className="absolute left-[-10000px] top-0 pointer-events-none" style={{ width: EXPORT_GRID_WIDTH }}>
                  <PhotoGridCanvas ref={exportRef} tiles={tiles} stats={stats} labels={statLabels} />
                </div>
              </div>
            )}
          </div>

          <div className="flex-none h-20 px-4 border-t border-surface-border bg-modal-bg flex items-center justify-end">
            <button
              onClick={handleExport}
              disabled={tiles.length === 0 || isLoading || isExporting}
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

const getCropFrameStyle = (tile: EditableGridTile): React.CSSProperties => {
  const aspect = getTileFrameAspect(tile);
  const maxWidthByHeight = Number((64 * aspect).toFixed(4));
  return {
    aspectRatio: aspect,
    width: `min(86vw, ${maxWidthByHeight}vh)`
  };
};

const formatGridDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
};

const createTileFromPhoto = (photo: LoadedGridPhoto): EditableGridTile => ({
  ...photo,
  crop: getInitialHistoryPhotoGridCrop(photo.imageSize, PHOTO_RECAP_TILE_ASPECT)
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
  stats: ReturnType<typeof buildHistoryStats>;
  labels: {
    plays: string;
    games: string;
    players: string;
  };
  onSelect?: (index: number) => void;
}

const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({ tiles, stats, labels, onSelect }, ref) => (
  <div ref={ref} className="w-full aspect-[4/5] bg-app-bg p-3 flex flex-col gap-2 rounded-xl border border-surface-border shadow-2xl overflow-hidden">
    <div className="flex-none h-[13%] min-h-[54px] rounded-lg bg-app-bg-deep border border-surface-border px-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] leading-none font-bold text-brand-primary uppercase tracking-normal">{formatGridDate(stats.latestPlayedAt || Date.now())}</div>
        <div className="mt-1 text-sm leading-tight font-black text-txt-title truncate">{stats.gameCount} {labels.games}</div>
      </div>
      <div className="flex items-center gap-2 text-right">
        <StatPill value={stats.playCount} label={labels.plays} />
        <StatPill value={stats.playerCount} label={labels.players} />
      </div>
    </div>

    <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-4 gap-1.5">
      {Array.from({ length: PHOTO_RECAP_TILE_COUNT }).map((_, index) => {
        const tile = tiles[index];
        return (
          <button
            key={`${tile?.id || 'empty'}-${index}`}
            onClick={() => tile && onSelect?.(index)}
            disabled={!tile || !onSelect}
            className="bg-surface-recessed rounded-md overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform relative min-h-0"
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
  </div>
));

PhotoGridCanvas.displayName = 'PhotoGridCanvas';

const StatPill: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="min-w-[54px]">
    <div className="text-base leading-none font-black font-mono text-txt-title">{value}</div>
    <div className="mt-0.5 text-[8px] leading-none font-bold text-txt-muted uppercase tracking-normal">{label}</div>
  </div>
);

const PhotoImage: React.FC<{ tile: EditableGridTile }> = ({ tile }) => {
  const base = getHistoryPhotoGridBaseSize(tile.imageSize, getTileFrameAspect(tile));
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
    <div className="relative w-full h-full overflow-hidden bg-app-bg-deep">
      <PhotoImage tile={tile} />
      <div className="absolute left-0 right-0 bottom-0 px-1.5 py-1 bg-black/55 text-white text-left">
        <span className="block text-[9px] leading-tight font-bold truncate">{tile.gameName}</span>
        <span className="block text-[7px] leading-tight text-white/65 font-mono">{formatGridDate(tile.endTime)}</span>
      </div>
    </div>
  );
};

export default HistoryPhotoGridShareModal;

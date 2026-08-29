import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Image as ImageIcon, Loader2, Share2, X, Trophy } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { buildHistoryStats, HistoryPhotoGridItem, selectHistoryPhotoGridItems, selectSpecificGamePhotoGridItems } from '../../utils/historyStats';
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
import { DATA_LIMITS } from '../../dataLimits';

interface LoadedGridPhoto {
  id: string;
  itemKey: string;
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
  contextLabel: string;
  selectionMode?: 'games' | 'records';
  playerCountOverride?: number;
  playerLabelOverride?: string;
  onClose: () => void;
}

const EXPORT_GRID_WIDTH = 1080;
const PHOTO_RECAP_TILE_COUNT = 8;
const PHOTO_RECAP_TILE_ASPECT = 16 / 9;
const PHOTO_RECAP_CAPTION_HEIGHT_RATIO = 0.08;
const getLimitedCandidatePhotos = (item: HistoryPhotoGridItem) => (
  item.candidatePhotos.slice(0, DATA_LIMITS.QUERY.HISTORY_PHOTO_GRID_CANDIDATES)
);

const getTileFrameAspect = (tile: Pick<EditableGridTile, 'imageSize'>): number => (
  PHOTO_RECAP_TILE_ASPECT
);

const HistoryPhotoGridShareModal: React.FC<HistoryPhotoGridShareModalProps> = ({
  isOpen,
  entries,
  contextLabel,
  selectionMode = 'games',
  playerCountOverride,
  playerLabelOverride,
  onClose
}) => {
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
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedFile, setGeneratedFile] = useState<File | null>(null);

  const gridItems = useMemo(
    () => selectionMode === 'records'
      ? selectSpecificGamePhotoGridItems(entries[0], PHOTO_RECAP_TILE_COUNT)
      : selectHistoryPhotoGridItems(entries, PHOTO_RECAP_TILE_COUNT),
    [entries, selectionMode]
  );
  const stats = useMemo(() => {
    const baseStats = buildHistoryStats(entries);
    return playerCountOverride === undefined
      ? baseStats
      : { ...baseStats, playerCount: playerCountOverride };
  }, [entries, playerCountOverride]);
  const gridItemByItemKey = useMemo(() => (
    new Map(gridItems.map(item => [item.itemKey, item]))
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

  const handleBackToEdit = () => {
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl);
      setGeneratedImageUrl(null);
      setGeneratedFile(null);
    }
  };

  useEffect(() => {
    return () => {
      if (generatedImageUrl) {
        URL.revokeObjectURL(generatedImageUrl);
      }
    };
  }, [generatedImageUrl]);

  const loadGridPhoto = async (
    item: HistoryPhotoGridItem,
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
        itemKey: item.itemKey,
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
      if (generatedImageUrl) {
        URL.revokeObjectURL(generatedImageUrl);
        setGeneratedImageUrl(null);
        setGeneratedFile(null);
      }
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

    const item = gridItemByItemKey.get(tile.itemKey);
    if (!item) return;

    getLimitedCandidatePhotos(item).forEach(candidate => {
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

  const handleGenerateImage = async () => {
    if (!exportRef.current || tiles.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await toBlob(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: 'rgb(var(--c-app-bg))',
        skipFonts: true
      });
      if (!blob) throw new Error('Failed to generate image');

      const url = URL.createObjectURL(blob);
      const fileName = `history_grid_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      setGeneratedImageUrl(url);
      setGeneratedFile(file);
    } catch (error) {
      console.error('History grid generation failed', error);
      showToast({ message: t('grid_export_failed'), type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareImage = async () => {
    if (!generatedFile || !generatedImageUrl) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: [generatedFile] })) {
        await navigator.share({ files: [generatedFile], title: t('grid_share_title') });
      } else {
        const link = document.createElement('a');
        link.href = generatedImageUrl;
        link.download = generatedFile.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast({ message: t('grid_download_success'), type: 'success' });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('History grid share failed', error);
        showToast({ message: t('grid_export_failed'), type: 'error' });
      }
    }
  };

  if (!isOpen) return null;

  const cropPhotoOptions = cropDraft
    ? (() => {
      const item = gridItemByItemKey.get(cropDraft.itemKey);
      if (!item) return [];
      const candidateIds = new Set(getLimitedCandidatePhotos(item).map(photo => photo.photoId));
      return photoPool.filter(photo => photo.itemKey === cropDraft.itemKey && candidateIds.has(photo.id));
    })()
    : [];
  const statLabels = {
    plays: t('stats_count_label'),
    games: t('stats_games_label'),
    players: playerLabelOverride || t('stats_players_label')
  };

  return (
    <div className="fixed inset-0 bg-app-bg-deep/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200" style={{ zIndex }}>
      <div className="flex-none h-16 px-4 border-b border-surface-border bg-modal-bg flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
            <ImageIcon size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-txt-title truncate">
              {generatedImageUrl ? t('grid_generated_title') : t('grid_modal_title')}
            </h3>
            <p className="text-[11px] text-txt-muted truncate">
              {cropDraft
                ? t('grid_crop_hint')
                : t(selectionMode === 'records' ? 'grid_modal_subtitle_records' : 'grid_modal_subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (cropDraft) {
              setCropDraft(null);
            } else if (generatedImageUrl) {
              handleBackToEdit();
            } else {
              onClose();
            }
          }}
          className="p-2 rounded-full bg-modal-bg-elevated text-txt-secondary hover:text-txt-title transition-colors"
        >
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
      ) : generatedImageUrl ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center justify-center gap-3">
            <div className="w-full max-w-[520px] flex flex-col items-center justify-center">
              <div className="relative rounded-xl overflow-hidden shadow-2xl border border-surface-border bg-app-bg-deep max-h-[70vh] flex items-center justify-center">
                <img
                  src={generatedImageUrl}
                  alt="Generated Photo Grid"
                  className="max-w-full max-h-[70vh] object-contain select-all"
                  style={{ WebkitTouchCallout: 'default' } as React.CSSProperties}
                />
              </div>
            </div>
          </div>

          <div className="flex-none h-20 px-4 border-t border-surface-border bg-modal-bg flex items-center justify-end gap-3">
            <button
              onClick={handleBackToEdit}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-bg border border-surface-border text-txt-primary font-bold text-sm active:scale-95 transition-all"
            >
              {t('grid_back_to_edit')}
            </button>
            <button
              onClick={handleShareImage}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold text-sm active:scale-95 transition-all"
            >
              <Share2 size={18} />
              {t('grid_share_button')}
            </button>
          </div>
        </>
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
                <PhotoGridCanvas tiles={tiles} stats={stats} labels={statLabels} contextLabel={contextLabel} onSelect={openCropEditor} isSingleGame={selectionMode === 'records'} />
                <div className="absolute left-[-10000px] top-0 pointer-events-none" style={{ width: EXPORT_GRID_WIDTH }}>
                  <PhotoGridCanvas ref={exportRef} tiles={tiles} stats={stats} labels={statLabels} contextLabel={contextLabel} isSingleGame={selectionMode === 'records'} />
                </div>
              </div>
            )}
          </div>

          <div className="flex-none h-20 px-4 border-t border-surface-border bg-modal-bg flex items-center justify-end">
            <button
              onClick={handleGenerateImage}
              disabled={tiles.length === 0 || isLoading || isExporting}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold text-sm disabled:bg-surface-bg disabled:text-txt-muted disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
              {isExporting ? t('grid_exporting') : t('grid_generate_action')}
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
  itemKey: draft.itemKey,
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
  contextLabel: string;
  labels: {
    plays: string;
    games: string;
    players: string;
  };
  onSelect?: (index: number) => void;
  isSingleGame?: boolean;
}
const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({ tiles, stats, contextLabel, labels, onSelect, isSingleGame }, ref) => {
  const activeTiles = useMemo(() => tiles.filter(tile => tile && tile.url), [tiles]);
  const N = activeTiles.length;
  const shouldHideTileGameName = isSingleGame || new Set(activeTiles.map(tile => tile.gameKey)).size === 1;

  const layout = useMemo(() => {
    if (N === 0) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    if (N === 1) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    if (N === 2) return { cols: 1, rows: 2, aspect: PHOTO_RECAP_TILE_ASPECT / 2 };

    const cols = 2;
    const rows = N % 2 !== 0 ? 2 + (N - 1) / 2 : N / 2;
    const photoOnlyAspect = (2 * PHOTO_RECAP_TILE_ASPECT) / rows;
    const captionHeight = shouldHideTileGameName ? 0 : rows * PHOTO_RECAP_CAPTION_HEIGHT_RATIO;
    const aspect = 1 / (1 / photoOnlyAspect + captionHeight);
    return { cols, rows, aspect };
  }, [N, shouldHideTileGameName]);

  if (N === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        containerType: 'inline-size',
        aspectRatio: `${layout.aspect}`
      }}
      className="w-full bg-app-bg p-[1.2cqw] flex flex-col gap-[1.2cqw] rounded-[2cqw] border border-surface-border shadow-2xl overflow-hidden"
    >
      <div className="flex-none rounded-[1.5cqw] bg-app-bg-deep border border-surface-border px-[2cqw] py-[2cqw] flex items-center justify-between gap-[1.5cqw]">
        <div className="min-w-0 flex-1">
          <div className="text-[4.2cqw] leading-tight font-black text-txt-title truncate">{contextLabel}</div>
        </div>
        <div className="flex items-center gap-[1.5cqw] text-right shrink-0">
          <StatPill value={stats.gameCount} label={labels.games} />
          <StatPill value={stats.playCount} label={labels.plays} />
          <StatPill value={stats.playerCount} label={labels.players} />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 grid gap-[0.8cqw]"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`
        }}
      >
        {activeTiles.map((tile, index) => {
          const isLarge = N >= 3 && N % 2 !== 0 && index === 0;

          return (
            <button
              key={`${tile.id}-${index}`}
              onClick={() => onSelect?.(tiles.indexOf(tile))}
              disabled={!onSelect}
              className={`bg-surface-recessed rounded-[1cqw] overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform relative min-h-0 ${
                isLarge ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'
              }`}
            >
              <PhotoTile tile={tile} hideGameName={shouldHideTileGameName} />
            </button>
          );
        })}
      </div>
    </div>
  );
});

PhotoGridCanvas.displayName = 'PhotoGridCanvas';

const StatPill: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="min-w-[15cqw]">
    <div className="text-[5.5cqw] leading-none font-black font-mono text-txt-title">{value}</div>
    <div className="mt-[0.5cqw] text-[2.4cqw] leading-none font-bold text-txt-muted uppercase tracking-normal">{label}</div>
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

const PhotoTile: React.FC<{ tile: EditableGridTile; hideGameName?: boolean }> = ({ tile, hideGameName }) => {
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-surface-recessed">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-app-bg-deep">
        <PhotoImage tile={tile} />
        <div className="pointer-events-none absolute right-[1.5cqw] bottom-[1.5cqw] px-[1.2cqw] py-[0.8cqw] rounded-[0.8cqw] bg-black/55 text-white">
          <span className="text-[2.2cqw] leading-none text-white/75 font-mono">{formatGridDate(tile.endTime)}</span>
        </div>
      </div>
      {!hideGameName && (
        <div className="flex-none h-[8cqw] min-h-0 px-[2cqw] border-t-2 border-brand-primary/35 bg-app-bg-deep flex items-center">
          <span className="min-w-0 flex-1 truncate text-left text-[3.2cqw] leading-none font-bold text-txt-primary">
            {tile.gameName}
          </span>
        </div>
      )}
    </div>
  );
};

export default HistoryPhotoGridShareModal;

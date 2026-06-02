import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Move, RefreshCcw, Replace, Scan, Share2, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { selectHistoryPhotoGridItems } from '../../utils/historyStats';
import {
  clampHistoryPhotoGridOffset,
  getDefaultHistoryPhotoGridFitMode,
  getNextHistoryPhotoGridFitMode,
  HistoryPhotoGridFitMode
} from '../../utils/historyPhotoGrid';
import { imageService } from '../../services/imageService';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { useToast } from '../../hooks/useToast';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';

interface LoadedGridPhoto {
  id: string;
  gameName: string;
  url: string;
  fitMode: HistoryPhotoGridFitMode;
}

interface EditableGridTile extends LoadedGridPhoto {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface HistoryPhotoGridShareModalProps {
  isOpen: boolean;
  entries: HistoryGameEntry[];
  onClose: () => void;
}

const HistoryPhotoGridShareModal: React.FC<HistoryPhotoGridShareModalProps> = ({ isOpen, entries, onClose }) => {
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'history-photo-grid-share');
  const { showToast } = useToast();
  const { t } = useHistoryStatsTranslation();
  const exportRef = useRef<HTMLDivElement>(null);
  const [photoPool, setPhotoPool] = useState<LoadedGridPhoto[]>([]);
  const [tiles, setTiles] = useState<EditableGridTile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dragRef = useRef<{ index: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const gridItems = useMemo(() => selectHistoryPhotoGridItems(entries, Number.MAX_SAFE_INTEGER), [entries]);
  const selectedTile = selectedIndex !== null ? tiles[selectedIndex] : null;

  useEffect(() => {
    if (!isOpen) {
      photoPool.forEach(photo => URL.revokeObjectURL(photo.url));
      setPhotoPool([]);
      setTiles([]);
      setSelectedIndex(null);
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
          const fitMode = await detectFitMode(url);
          loaded.push({ id: item.photoId, gameName: item.gameName, url, fitMode });
        } catch (error) {
          console.warn('Failed to load history grid image', error);
        }
      }

      if (active) {
        setPhotoPool(loaded);
        setTiles(loaded.slice(0, 9).map(createTileFromPhoto));
        setSelectedIndex(null);
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

  const updateTile = (index: number, updates: Partial<EditableGridTile>) => {
    setTiles(prev => prev.map((tile, tileIndex) => tileIndex === index ? { ...tile, ...updates } : tile));
  };

  const replaceSelectedTile = (photo: LoadedGridPhoto) => {
    if (selectedIndex === null) return;
    updateTile(selectedIndex, createTileFromPhoto(photo));
  };

  const resetSelectedTile = () => {
    if (selectedIndex === null) return;
    updateTile(selectedIndex, { offsetX: 0, offsetY: 0, scale: 1 });
  };

  const toggleSelectedFitMode = () => {
    if (selectedIndex === null || !selectedTile) return;
    updateTile(selectedIndex, {
      fitMode: getNextHistoryPhotoGridFitMode(selectedTile.fitMode),
      offsetX: 0,
      offsetY: 0,
      scale: 1
    });
  };

  const handlePointerDown = (index: number, event: React.PointerEvent<HTMLDivElement>) => {
    const tile = tiles[index];
    setSelectedIndex(index);
    if (!tile || tile.fitMode !== 'cover') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: tile.offsetX,
      offsetY: tile.offsetY
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    updateTile(drag.index, {
      offsetX: clampHistoryPhotoGridOffset(drag.offsetX + event.clientX - drag.startX),
      offsetY: clampHistoryPhotoGridOffset(drag.offsetY + event.clientY - drag.startY)
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
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
            <p className="text-[11px] text-txt-muted">{t('grid_modal_subtitle')}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-modal-bg-elevated text-txt-secondary hover:text-txt-title transition-colors">
          <X size={20} />
        </button>
      </div>

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
            <PhotoGridCanvas
              tiles={tiles}
              selectedIndex={selectedIndex}
              editable
              onSelect={setSelectedIndex}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div className="absolute left-[-10000px] top-0 w-[520px] pointer-events-none">
              <PhotoGridCanvas ref={exportRef} tiles={tiles} />
            </div>
          </div>
        )}
      </div>

      <div className="flex-none px-3 py-3 border-t border-surface-border bg-modal-bg flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar flex items-center gap-2">
          <button
            onClick={toggleSelectedFitMode}
            disabled={!selectedTile}
            className="h-10 px-3 rounded-xl bg-modal-bg-elevated border border-surface-border text-txt-secondary font-bold text-xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Scan size={15} />
            {selectedTile?.fitMode === 'contain' ? t('grid_fit_contain') : t('grid_fit_cover')}
          </button>
          <button
            onClick={resetSelectedTile}
            disabled={!selectedTile}
            className="h-10 px-3 rounded-xl bg-modal-bg-elevated border border-surface-border text-txt-secondary font-bold text-xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={15} />
            {t('grid_reset_tile')}
          </button>
          {selectedTile && photoPool.length > 1 && (
            <div className="flex items-center gap-1.5 pl-1">
              <Replace size={15} className="text-txt-muted shrink-0" />
              {photoPool.slice(0, 18).map(photo => (
                <button
                  key={photo.id}
                  onClick={() => replaceSelectedTile(photo)}
                  className={`w-10 h-10 rounded-lg overflow-hidden border shrink-0 ${selectedTile.id === photo.id ? 'border-brand-primary' : 'border-surface-border'}`}
                  title={photo.gameName}
                >
                  <img src={photo.url} alt={photo.gameName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={tiles.length === 0 || isExporting}
          className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold text-sm disabled:bg-surface-bg disabled:text-txt-muted disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : (typeof navigator.share === 'function' ? <Share2 size={18} /> : <Download size={18} />)}
          {isExporting ? t('grid_exporting') : t('grid_share_button')}
        </button>
      </div>
    </div>
  );
};

const detectFitMode = (url: string): Promise<HistoryPhotoGridFitMode> => {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(getDefaultHistoryPhotoGridFitMode(image.naturalWidth, image.naturalHeight));
    image.onerror = () => resolve('cover');
    image.src = url;
  });
};

const createTileFromPhoto = (photo: LoadedGridPhoto): EditableGridTile => ({
  ...photo,
  offsetX: 0,
  offsetY: 0,
  scale: 1
});

interface PhotoGridCanvasProps {
  tiles: EditableGridTile[];
  selectedIndex?: number | null;
  editable?: boolean;
  onSelect?: (index: number) => void;
  onPointerDown?: (index: number, event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: () => void;
}

const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({
  tiles,
  selectedIndex = null,
  editable = false,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp
}, ref) => (
  <div ref={ref} className="w-full aspect-square bg-app-bg p-2 grid grid-cols-3 gap-1 rounded-xl border border-surface-border shadow-2xl">
    {Array.from({ length: 9 }).map((_, index) => {
      const tile = tiles[index];
      const isSelected = selectedIndex === index;
      return (
        <div
          key={`${tile?.id || 'empty'}-${index}`}
          onClick={() => tile && onSelect?.(index)}
          onPointerDown={tile ? (event) => onPointerDown?.(index, event) : undefined}
          onPointerMove={tile ? onPointerMove : undefined}
          onPointerUp={tile ? onPointerUp : undefined}
          onPointerCancel={tile ? onPointerUp : undefined}
          className={`relative bg-surface-recessed rounded-md overflow-hidden touch-none select-none ${editable && tile ? 'cursor-grab active:cursor-grabbing' : ''} ${isSelected ? 'ring-2 ring-brand-primary ring-offset-2 ring-offset-app-bg' : ''}`}
        >
          {tile ? (
            <>
              <img
                src={tile.url}
                alt={tile.gameName}
                draggable={false}
                className={`absolute inset-0 w-full h-full select-none ${tile.fitMode === 'contain' ? 'object-contain p-1 pb-6' : 'object-cover'}`}
                style={tile.fitMode === 'cover' ? { transform: `translate(${tile.offsetX}px, ${tile.offsetY}px) scale(${tile.scale})` } : undefined}
              />
              {editable && tile.fitMode === 'cover' && (
                <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-app-bg-deep/70 text-white flex items-center justify-center pointer-events-none">
                  <Move size={12} />
                </div>
              )}
              <div className={`absolute inset-x-0 bottom-0 px-1.5 py-1 text-white text-[10px] font-bold truncate ${tile.fitMode === 'contain' ? 'bg-app-bg-deep' : 'bg-app-bg-deep/70'}`}>
                {tile.gameName}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-txt-muted/40">
              <ImageIcon size={22} />
            </div>
          )}
        </div>
      );
    })}
  </div>
));

PhotoGridCanvas.displayName = 'PhotoGridCanvas';

export default HistoryPhotoGridShareModal;

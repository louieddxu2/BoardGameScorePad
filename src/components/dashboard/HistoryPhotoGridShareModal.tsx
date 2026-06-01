import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { selectHistoryPhotoGridItems } from '../../utils/historyStats';
import { imageService } from '../../services/imageService';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { useToast } from '../../hooks/useToast';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';

interface LoadedGridImage {
  id: string;
  gameName: string;
  url: string;
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<LoadedGridImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const gridItems = useMemo(() => selectHistoryPhotoGridItems(entries), [entries]);

  useEffect(() => {
    if (!isOpen) {
      images.forEach(image => URL.revokeObjectURL(image.url));
      setImages([]);
      return;
    }

    let active = true;
    const generatedUrls: string[] = [];

    const loadImages = async () => {
      setIsLoading(true);
      const loaded: LoadedGridImage[] = [];

      for (const item of gridItems) {
        try {
          const localImage = await imageService.getImage(item.photoId);
          if (!localImage || !active) continue;
          const url = URL.createObjectURL(localImage.blob);
          generatedUrls.push(url);
          loaded.push({ id: item.photoId, gameName: item.gameName, url });
        } catch (error) {
          console.warn('Failed to load history grid image', error);
        }
      }

      if (active) {
        setImages(loaded);
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

  const handleExport = async () => {
    if (!gridRef.current || images.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await toBlob(gridRef.current, {
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
        ) : images.length === 0 ? (
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
          <div ref={gridRef} className="w-full max-w-[520px] aspect-square bg-app-bg p-2 grid grid-cols-3 gap-1 rounded-xl border border-surface-border shadow-2xl">
            {Array.from({ length: 9 }).map((_, index) => {
              const image = images[index];
              return (
                <div key={image?.id || index} className="relative bg-surface-recessed rounded-md overflow-hidden">
                  {image ? (
                    <>
                      <img src={image.url} alt={image.gameName} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-app-bg-deep/70 text-white text-[10px] font-bold truncate">
                        {image.gameName}
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
        )}
      </div>

      <div className="flex-none h-20 px-4 border-t border-surface-border bg-modal-bg flex items-center justify-end">
        <button
          onClick={handleExport}
          disabled={images.length === 0 || isExporting}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold text-sm disabled:bg-surface-bg disabled:text-txt-muted disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : (typeof navigator.share === 'function' ? <Share2 size={18} /> : <Download size={18} />)}
          {isExporting ? t('grid_exporting') : t('grid_share_button')}
        </button>
      </div>
    </div>
  );
};

export default HistoryPhotoGridShareModal;

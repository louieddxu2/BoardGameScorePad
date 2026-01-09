
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HistoryRecord, GameSession, ScoreColumn } from '../../types';
import { ArrowLeft, Share2, Download, Check, Settings } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ScoreGrid from '../session/parts/ScoreGrid';
import TotalsBar from '../session/parts/TotalsBar';
import ScreenshotModal from '../session/modals/ScreenshotModal';
import HistorySettingsModal from './modals/HistorySettingsModal';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { ScreenshotLayout } from '../session/hooks/useSessionState';
import { db } from '../../db'; 
import { useAppData } from '../../hooks/useAppData';
import ShareMenu from '../session/modals/ShareMenu'; 
import PhotoGalleryModal from '../session/modals/PhotoGalleryModal'; 
import { imageService } from '../../services/imageService';
import { compressAndResizeImage } from '../../utils/imageProcessing';

interface HistoryReviewViewProps {
  record: HistoryRecord;
  onExit: () => void;
  zoomLevel: number;
}

const HistoryReviewView: React.FC<HistoryReviewViewProps> = ({ record: initialRecord, onExit, zoomLevel }) => {
  const [record, setRecord] = useState<HistoryRecord>(initialRecord);
  const { locationHistory, updateLocationHistory } = useAppData();

  useEffect(() => {
      setRecord(initialRecord);
  }, [initialRecord]);

  const fakeSession: GameSession = useMemo(() => ({
    id: 'history-review',
    templateId: record.templateId,
    startTime: record.startTime,
    players: record.players, 
    status: 'completed',
    scoringRule: record.snapshotTemplate.defaultScoringRule
  }), [record]);

  const template = record.snapshotTemplate;
  const { downloadCloudImage } = useGoogleDrive();
  const [baseImage, setBaseImage] = useState<string | null>(null);
  
  // Modal States
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false); 
  const [showPhotoGallery, setShowPhotoGallery] = useState(false); 
  
  const [screenshotLayout, setScreenshotLayout] = useState<ScreenshotLayout | null>(null);
  const { showToast } = useToast();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // --- Back Button Handler (Local Priority) ---
  useEffect(() => {
      const handleHistoryBackPress = () => {
          // Priority 1: Photo Gallery
          if (showPhotoGallery) { setShowPhotoGallery(false); return; }
          // Priority 2: Settings Modal
          if (showSettingsModal) { setShowSettingsModal(false); return; }
          // Priority 3: Screenshot Modal
          if (showScreenshotModal) { setShowScreenshotModal(false); return; }
          // Priority 4: Share Menu
          if (showShareMenu) { setShowShareMenu(false); return; }
          
          // Default: Exit View
          onExit();
      };

      window.addEventListener('app-back-press', handleHistoryBackPress);
      return () => window.removeEventListener('app-back-press', handleHistoryBackPress);
  }, [showPhotoGallery, showSettingsModal, showScreenshotModal, showShareMenu, onExit]);

  // Load cloud image
  useEffect(() => {
      let active = true;
      let objectUrl: string | null = null;

      const loadBackground = async () => {
          if (template.cloudImageId) {
              const imgBlob = await downloadCloudImage(template.cloudImageId);
              if (active && imgBlob) {
                  objectUrl = URL.createObjectURL(imgBlob);
                  setBaseImage(objectUrl);
              }
          }
      };
      loadBackground();

      return () => {
          active = false;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
  }, [template.cloudImageId, downloadCloudImage]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);
  const gridContentRef = useRef<HTMLDivElement>(null);
  const totalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = tableContainerRef.current;
    const bar = totalBarScrollRef.current;
    if (!grid || !bar) return;
    const handleScroll = () => {
      if (bar.scrollLeft !== grid.scrollLeft) {
          bar.scrollLeft = grid.scrollLeft;
      }
    };
    grid.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      grid.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const gridContent = gridContentRef.current;
    const totalContent = totalContentRef.current;
    if (!gridContent || !totalContent) return;
    const observer = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === gridContent) {
             const gridWidth = gridContent.offsetWidth;
             const stickyHeader = document.querySelector('#live-player-header-row > div:first-child') as HTMLElement;
             const headerOffset = stickyHeader ? stickyHeader.offsetWidth : 70;
             const newTotalWidth = `${Math.max(0, gridWidth - headerOffset)}px`;
             if (totalContent.style.width !== newTotalWidth) {
                 totalContent.style.width = newTotalWidth;
             }
          }
        }
      });
    });
    observer.observe(gridContent);
    return () => observer.disconnect();
  }, []);

  const winners = record.winnerIds || [];

  const handleScreenshotRequest = (mode: 'full' | 'simple') => {
      setShowShareMenu(false); 

      const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
      const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
      const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');
      
      if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
          showToast({ message: "無法測量佈局，截圖可能不準確。", type: 'warning' });
          setScreenshotLayout(null);
          setShowScreenshotModal(true);
          return;
      }

      const measuredLayout: ScreenshotLayout = {
          itemWidth: itemHeaderEl.offsetWidth,
          playerWidths: {},
          playerHeaderHeight: playerHeaderRowEl.offsetHeight,
          rowHeights: {},
      };

      playerHeaderEls.forEach(el => {
          const playerId = el.getAttribute('data-player-header-id');
          if (playerId) {
              measuredLayout.playerWidths[playerId] = (el as HTMLElement).offsetWidth;
          }
      });
      
      template.columns.forEach(col => {
        const rowEl = document.getElementById(`row-${col.id}`) as HTMLElement;
        if (rowEl) {
          measuredLayout.rowHeights[col.id] = rowEl.offsetHeight;
        }
      });

      setScreenshotLayout(measuredLayout);
      setShowScreenshotModal(true);
  };

  const handleUpdateRecord = async (updatedRecord: HistoryRecord) => {
      try {
          if (updatedRecord.id) {
              // Use put for full object update to avoid Dexie UpdateSpec typing issues
              await db.history.put(updatedRecord);
              setRecord(updatedRecord);
              if (updatedRecord.location) {
                  updateLocationHistory(updatedRecord.location);
              }
              showToast({ message: "紀錄已更新", type: 'success' });
          }
      } catch (e) {
          console.error("Failed to update record", e);
          showToast({ message: "更新失敗", type: 'error' });
      }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const objectUrl = URL.createObjectURL(file);
          
          compressAndResizeImage(objectUrl, 1, 1920)
            .then(async (compressedBlob) => {
                const savedImg = await imageService.saveImage(compressedBlob, record.id, 'session');
                const currentPhotos = record.photos || [];
                const updatedRecord = { 
                    ...record, 
                    photos: [...currentPhotos, savedImg.id] 
                };
                
                await db.history.update(record.id, { photos: updatedRecord.photos });
                setRecord(updatedRecord);

                showToast({ message: "照片已儲存", type: 'success' });
                
                setShowShareMenu(false);
                setShowPhotoGallery(true);
                
                URL.revokeObjectURL(objectUrl);
            })
            .catch(err => {
                console.error("Photo save failed", err);
                showToast({ message: "照片處理失敗", type: 'error' });
                URL.revokeObjectURL(objectUrl);
            });
      }
      e.target.value = '';
  };

  const handleDeletePhoto = async (id: string) => {
      try {
          await imageService.deleteImage(id);
          const currentPhotos = record.photos || [];
          const updatedPhotos = currentPhotos.filter(pid => pid !== id);
          
          await db.history.update(record.id, { photos: updatedPhotos });
          setRecord({ ...record, photos: updatedPhotos });
          
          showToast({ message: "照片已刪除", type: 'info' });
      } catch (e) {
          console.error("Delete failed", e);
          showToast({ message: "刪除失敗", type: 'error' });
      }
  };

  const handleOpenGallery = () => {
      setShowShareMenu(false);
      setShowPhotoGallery(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden relative animate-in fade-in duration-300">
        
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

        {/* --- Header --- */}
        <div className="flex-none bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700 shadow-md z-20">
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('app-back-press'))} 
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="font-bold text-lg px-2 py-1 text-white truncate max-w-[200px]">
                    {record.gameName} <span className="text-xs text-slate-500 font-normal ml-2 hidden sm:inline">歷史回顧</span>
                </div>
            </div>
            
            <div className="flex items-center gap-1 relative">
                <button 
                    onClick={() => setShowSettingsModal(true)} 
                    className="p-2 hover:bg-slate-700 hover:text-sky-400 rounded-lg text-slate-400"
                    title="編輯紀錄資訊"
                >
                    <Settings size={20} />
                </button>
                <button 
                    onClick={() => setShowShareMenu(!showShareMenu)} 
                    className="p-2 hover:bg-slate-700 hover:text-indigo-400 rounded-lg text-slate-400"
                    title="分享/照片"
                >
                    <Share2 size={20} />
                </button>

                {showShareMenu && (
                    <ShareMenu 
                        isCopying={false}
                        onScreenshotRequest={handleScreenshotRequest}
                        hasVisuals={!!template.globalVisuals}
                        onUploadImage={undefined} 
                        onOpenGallery={handleOpenGallery}
                        photoCount={record.photos?.length || 0}
                    />
                )}
                {showShareMenu && <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)}></div>}
            </div>
        </div>

        {/* --- Grid Body --- */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <ScoreGrid
                session={fakeSession}
                template={template}
                editingCell={null}
                editingPlayerId={null}
                onCellClick={() => {}} 
                onPlayerHeaderClick={() => {}} 
                onColumnHeaderClick={() => {}} 
                onUpdateTemplate={() => {}} 
                scrollContainerRef={tableContainerRef}
                contentRef={gridContentRef}
                baseImage={baseImage || undefined}
                isEditMode={false}
                zoomLevel={zoomLevel}
                previewValue={0}
            />
        </div>

        {/* --- Totals Footer --- */}
        <TotalsBar
            players={fakeSession.players}
            winners={winners}
            isPanelOpen={false} 
            panelHeight="0px"
            scrollRef={totalBarScrollRef}
            contentRef={totalContentRef}
            template={template}
            baseImage={baseImage || undefined}
            zoomLevel={zoomLevel} 
        />

        {/* --- Modals --- */}
        <ScreenshotModal
            isOpen={showScreenshotModal}
            onClose={() => setShowScreenshotModal(false)}
            initialMode="full"
            session={fakeSession}
            template={template}
            zoomLevel={zoomLevel}
            layout={screenshotLayout}
            baseImage={baseImage || undefined}
            customWinners={winners}
        />

        <PhotoGalleryModal 
            isOpen={showPhotoGallery}
            onClose={() => setShowPhotoGallery(false)}
            photoIds={record.photos || []}
            onUploadPhoto={() => galleryInputRef.current?.click()}
            onTakePhoto={() => photoInputRef.current?.click()}
            onDeletePhoto={handleDeletePhoto}
        />

        <HistorySettingsModal 
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            record={record}
            onSave={handleUpdateRecord}
            locationHistory={locationHistory}
        />
    </div>
  );
};

export default HistoryReviewView;

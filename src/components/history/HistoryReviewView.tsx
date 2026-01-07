
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
import { db } from '../../db'; // Import DB to save changes
import { useAppData } from '../../hooks/useAppData';

interface HistoryReviewViewProps {
  record: HistoryRecord;
  onExit: () => void;
  zoomLevel: number;
}

const HistoryReviewView: React.FC<HistoryReviewViewProps> = ({ record: initialRecord, onExit, zoomLevel }) => {
  // Use local state to reflect updates immediately without waiting for parent re-render
  const [record, setRecord] = useState<HistoryRecord>(initialRecord);
  
  // Access location history data and updater
  const { locationHistory, updateLocationHistory } = useAppData();

  useEffect(() => {
      setRecord(initialRecord);
  }, [initialRecord]);

  // 1. Adapter: Convert HistoryRecord to GameSession for ScoreGrid compatibility
  const fakeSession: GameSession = useMemo(() => ({
    id: 'history-review',
    templateId: record.templateId,
    startTime: record.startTime,
    players: record.players, // History records store players with full score data
    status: 'completed',
    scoringRule: record.snapshotTemplate.defaultScoringRule // Use the rule from snapshot
  }), [record]);

  const template = record.snapshotTemplate;
  const { downloadCloudImage } = useGoogleDrive();
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [screenshotLayout, setScreenshotLayout] = useState<ScreenshotLayout | null>(null);
  const { showToast } = useToast();

  // Load cloud image if available in the snapshot
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

  // Layout refs required by ScoreGrid/TotalsBar for syncing
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);
  const gridContentRef = useRef<HTMLDivElement>(null);
  const totalContentRef = useRef<HTMLDivElement>(null);

  // Sync scroll logic (reused from SessionView)
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

  // Sync content width logic (reused from SessionView)
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

  // Winners calculation for TotalsBar
  // Note: HistoryRecord already has winnerIds, so we can use that directly or re-calculate
  const winners = record.winnerIds || [];

  const handleScreenshotRequest = (mode: 'full' | 'simple') => {
      // 1. Measure current DOM layout
      const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
      const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
      const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');
      
      if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
          showToast({ message: "無法測量佈局，截圖可能不準確。", type: 'warning' });
          // Fallback: Open without layout (default sizing)
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

      // 2. Set layout and open modal
      setScreenshotLayout(measuredLayout);
      setShowScreenshotModal(true);
  };

  const handleUpdateRecord = async (updatedRecord: HistoryRecord) => {
      try {
          if (updatedRecord.id) {
              await db.history.update(updatedRecord.id, updatedRecord);
              setRecord(updatedRecord); // Update local view state immediately
              
              // If location changed, update the location history
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

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden relative animate-in fade-in duration-300">
        {/* --- Header --- */}
        <div className="flex-none bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700 shadow-md z-20">
            <div className="flex items-center gap-2">
                <button onClick={onExit} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 shrink-0">
                    <ArrowLeft size={20} />
                </button>
                <div className="font-bold text-lg px-2 py-1 text-white truncate max-w-[200px]">
                    {record.gameName} <span className="text-xs text-slate-500 font-normal ml-2 hidden sm:inline">歷史回顧</span>
                </div>
            </div>
            
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setShowSettingsModal(true)} 
                    className="p-2 hover:bg-slate-700 hover:text-sky-400 rounded-lg text-slate-400"
                    title="編輯紀錄資訊"
                >
                    <Settings size={20} />
                </button>
                <button 
                    onClick={() => handleScreenshotRequest('full')} 
                    className="p-2 hover:bg-slate-700 hover:text-indigo-400 rounded-lg text-slate-400"
                    title="分享截圖"
                >
                    <Share2 size={20} />
                </button>
            </div>
        </div>

        {/* --- Grid Body --- */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <ScoreGrid
                session={fakeSession}
                template={template}
                editingCell={null}
                editingPlayerId={null}
                onCellClick={() => {}} // Read-only: No-op
                onPlayerHeaderClick={() => {}} // Read-only
                onColumnHeaderClick={() => {}} // Read-only
                onUpdateTemplate={() => {}} // Read-only
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
            isPanelOpen={false} // Always collapsed (no input panel)
            panelHeight="0px"
            scrollRef={totalBarScrollRef}
            contentRef={totalContentRef}
            template={template}
            baseImage={baseImage || undefined}
        />

        {/* --- Screenshot Modal --- */}
        <ScreenshotModal
            isOpen={showScreenshotModal}
            onClose={() => setShowScreenshotModal(false)}
            initialMode="full"
            session={fakeSession}
            template={template}
            zoomLevel={zoomLevel}
            layout={screenshotLayout} // Pass the measured layout
            baseImage={baseImage || undefined}
            customWinners={winners} // Pass the known winners
        />

        {/* --- Settings Modal --- */}
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

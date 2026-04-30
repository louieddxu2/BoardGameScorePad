
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HistoryRecord, GameSession, SavedListItem } from '../../types';
import { ArrowLeft, Share2, Settings } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ScoreGrid from '../session/parts/ScoreGrid';
import TotalsBar from '../session/parts/TotalsBar';
import ScreenshotModal from '../session/modals/ScreenshotModal';
import HistorySettingsModal from './modals/HistorySettingsModal';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { googleDriveService } from '../../services/googleDrive'; // Import service directly for actions
import { ScreenshotLayout } from '../session/hooks/useSessionState';
import { db } from '../../db';
import { useAppData } from '../../hooks/useAppData';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import ShareMenu from '../session/modals/ShareMenu';
import PhotoGalleryModal from '../session/modals/PhotoGalleryModal';
import CameraView from '../scanner/CameraView';
import { getRecordScoringRule, getRecordTemplate } from '../../utils/historyUtils';
import { usePhotoManager } from '../../hooks/usePhotoManager';
import SmartSpacer from '../session/parts/SmartSpacer';

import { useHistoryTranslation } from '../../i18n/history';

interface HistoryReviewViewProps {
    record: HistoryRecord;
    onExit: () => void;
    zoomLevel: number;
}

const HistoryReviewView: React.FC<HistoryReviewViewProps> = ({ record: initialRecord, onExit, zoomLevel }) => {
    const [record, setRecord] = useState<HistoryRecord>(initialRecord);
    const { savedLocations, updateSavedLocation, saveTemplate } = useAppData(); // Renamed properties
    const { t } = useHistoryTranslation();

    // Track if data has been modified to trigger cloud sync on exit
    const isDirtyRef = useRef(false);

    useEffect(() => {
        setRecord(initialRecord);
        isDirtyRef.current = false; // Reset dirty state on new record load
    }, [initialRecord]);

    const fakeSession: GameSession = useMemo(() => ({
        id: 'history-review',
        name: record.gameName,
        bggId: record.bggId,
        templateId: record.templateId,
        startTime: record.startTime,
        players: record.players,
        status: 'completed',
        scoringRule: getRecordScoringRule(record),
        note: record.note || ''
    }), [record]);

    // Use helper to safely get template (handles missing/empty snapshot via virtual template)
    const template = useMemo(() => getRecordTemplate(record), [record]);

    const { downloadCloudImage, isAutoConnectEnabled, isConnected } = useGoogleDrive();
    const [baseImage, setBaseImage] = useState<string | null>(null);

    // Modal States
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showPhotoGallery, setShowPhotoGallery] = useState(false);
    const [screenshotLayout, setScreenshotLayout] = useState<ScreenshotLayout | null>(null);
    
    // [Logic] Determine if the list is "Short" (auto-open toolbox)
    const isShortList = useMemo(() => {
        return !baseImage && template.columns.length < 5;
    }, [baseImage, template.columns.length]);

    const [isToolboxOpen, setIsToolboxOpen] = useState(isShortList);
    const { showToast } = useToast();

    // === 照片管理（與計分板共用 usePhotoManager） ===
    const photos = usePhotoManager({
        contextId: record.id,
        currentPhotoIds: record.photos || [],
        onPhotosAdded: async (ids) => {
            const updated = { ...record, photos: ids, updatedAt: Date.now() };
            await db.history.put(updated);
            setRecord(updated);
            isDirtyRef.current = true;
            setShowShareMenu(false);
            setShowPhotoGallery(true);
        },
        onPhotoDeleted: async (ids) => {
            const updated = { ...record, photos: ids, updatedAt: Date.now() };
            await db.history.put(updated);
            setRecord(updated);
            isDirtyRef.current = true;
            showToast({ message: t('history_photo_delete_success'), type: 'info' });
        },
        onError: (type) => {
            if (type === 'save' || type === 'compress') {
                showToast({ message: t('history_photo_save_failed'), type: 'error' });
            } else {
                showToast({ message: t('history_update_failed'), type: 'error' });
            }
        }
    });

    const handleUpdateNote = async (updatedSession: GameSession) => {
        const updated = { ...record, note: updatedSession.note || '', updatedAt: Date.now() };
        await db.history.put(updated);
        setRecord(updated);
        isDirtyRef.current = true;
    };

    // --- Exit Logic with Cloud Sync ---
    const handleExitAndSync = () => {
        // Logic mirrored from useSessionManager.ts exitSession
        // [Fix] Use setTimeout to force this logic to the next tick, ensuring UI navigation happens immediately without blocking.
        if (isDirtyRef.current && isAutoConnectEnabled && isConnected) {
            setTimeout(() => {
                const backgroundBackup = async () => {
                    try {
                        let folderId = record.cloudFolderId;
                        let isNewFolder = false;

                        // If legacy record without folder ID, create one
                        if (!folderId) {
                            // This creates the folder in _ActiveSessions initially
                            folderId = await googleDriveService.createActiveSessionFolder(record.gameName, record.id);
                            // Update local DB immediately
                            await db.history.update(record.id, { cloudFolderId: folderId });
                            isNewFolder = true;
                        }

                        if (folderId) {
                            const { updatedRecord } = await googleDriveService.backupHistoryRecord(record, folderId);

                            if (updatedRecord.photoCloudIds && Object.keys(updatedRecord.photoCloudIds).length > 0) {
                                await db.history.update(record.id, { photoCloudIds: updatedRecord.photoCloudIds });
                            }

                            // If we just created this folder, it is currently in _ActiveSessions.
                            // We must move it to _History.
                            if (isNewFolder) {
                                await googleDriveService.moveSessionToHistory(folderId);
                            }
                            console.log("History auto-backup successful (background)");
                        }
                    } catch (e) {
                        console.error("Failed to initiate history backup", e);
                    }
                };
                backgroundBackup();
            }, 0);
        }
        onExit();
    };

    // [Standardized Navigation]
    // 1. History Root Entry: Handles the final exit and cloud sync trigger.
    // This decouples navigation state from cloud logic as requested.
    useModalBackHandler(true, handleExitAndSync, 'history-root');

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

    // [Update] Calculate winners for display
    // Need to map potentially UUID winnerIds back to current session player IDs (which might be slot_X)
    const winners = useMemo(() => {
        const storedWinnerIds = record.winnerIds || [];
        return record.players
            .filter(p => (p.linkedPlayerId && storedWinnerIds.includes(p.linkedPlayerId)) || storedWinnerIds.includes(p.id))
            .map(p => p.id);
    }, [record.winnerIds, record.players]);

    // Prepare Overlay Data for Photo Gallery
    const overlayData = useMemo(() => ({
        gameName: record.gameName,
        date: record.startTime,
        endTime: record.endTime, // Pass endTime for accurate history timestamp
        players: record.players,
        winners: winners
    }), [record.gameName, record.startTime, record.endTime, record.players, winners]);

    const handleScreenshotRequest = (mode: 'full' | 'simple') => {
        setShowShareMenu(false);

        const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
        const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
        const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');

        if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
            showToast({ message: t('history_measure_failed'), type: 'warning' });
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
                // [New] Update the updatedAt timestamp
                const recordToSave = { ...updatedRecord, updatedAt: Date.now() };
                await db.history.put(recordToSave);
                setRecord(recordToSave);
                isDirtyRef.current = true; // Mark as dirty

                if (recordToSave.location) {
                    // [Modified] Pass the generated locationId to ensure syncing
                    updateSavedLocation(recordToSave.location, recordToSave.locationId);
                }
                showToast({ message: t('history_update_success'), type: 'success' });
            }
        } catch (e) {
            console.error("Failed to update record", e);
            showToast({ message: t('history_update_failed'), type: 'error' });
        }
    };

    const handleOpenGallery = () => {
        setShowShareMenu(false);
        setShowPhotoGallery(true);
    };

    return (
        <div className="flex flex-col h-full bg-app-bg text-txt-primary overflow-hidden relative animate-in fade-in duration-300">

            <input ref={photos.photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={photos.handlePhotoSelect} />
            <input ref={photos.galleryInputRef} type="file" accept="image/*" className="hidden" onChange={photos.handlePhotoSelect} />

            {/* CameraView (shared with Session) */}
            {photos.isCameraOpen && (
                <CameraView
                    onCapture={photos.handleCameraBatchCapture}
                    onClose={() => photos.closeCamera()}
                />
            )}

            {/* --- Header --- */}
            <div className="flex-none bg-app-bg p-2 flex items-center justify-between border-b border-surface-border shadow-md z-20">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.history.back()}
                        className="p-2 hover:bg-surface-hover rounded-lg text-txt-secondary shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="font-bold text-lg px-2 py-1 text-txt-title truncate max-w-[200px]">
                        {record.gameName} <span className="text-xs text-txt-muted font-normal ml-2 hidden sm:inline">{t('history_review_subtitle')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 relative">
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2 hover:bg-surface-hover hover:text-brand-secondary rounded-lg text-txt-secondary"
                        title={t('history_edit_info')}
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => setShowShareMenu(!showShareMenu)}
                        className="p-2 hover:bg-surface-hover hover:text-brand-secondary rounded-lg text-txt-secondary"
                        title={t('history_share_photo')}
                    >
                        <Share2 size={20} />
                    </button>

                    <ShareMenu
                        isOpen={showShareMenu}
                        onClose={() => setShowShareMenu(false)}
                        isCopying={false}
                        onScreenshotRequest={handleScreenshotRequest}
                        hasVisuals={!!template.globalVisuals}
                        onUploadImage={undefined}
                        onOpenGallery={handleOpenGallery}
                        onTakePhoto={photos.openCamera}
                        photoCount={record.photos?.length || 0}
                        zIndex={100}
                    />
                </div>
            </div>

            {/* --- Grid Body --- */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <ScoreGrid
                    session={fakeSession}
                    template={template}
                    editingCell={null}
                    editingPlayerId={null}
                    onCellClick={() => { }}
                    onPlayerHeaderClick={() => { }}
                    onColumnHeaderClick={() => { }}
                    onUpdateTemplate={() => { }}
                    onAddColumn={() => { }} // No-op for review mode
                    scrollContainerRef={tableContainerRef}
                    contentRef={gridContentRef}
                    baseImage={baseImage || undefined}
                    isEditMode={false}
                    zoomLevel={zoomLevel}
                    previewValue={0}
                    onToggleToolbox={() => setIsToolboxOpen(!isToolboxOpen)}
                    isToolboxOpen={isToolboxOpen}
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

            {/* History Toolbox Drawer - No backdrop, matches Session InputPanel feel */}
            <div
                className={`fixed left-0 right-0 z-40 bg-modal-bg backdrop-blur-sm border-t border-surface-border shadow-[0_-8px_30px_rgba(var(--c-black)/0.2)] transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${isToolboxOpen ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ height: '40vh', bottom: 0 }}
            >
                <div className="flex-1 min-h-0 bg-modal-bg relative">
                    <SmartSpacer
                        mode="history"
                        session={fakeSession}
                        template={template}
                        onTakePhoto={photos.openCamera}
                        onScreenshot={() => {
                            setIsToolboxOpen(false);
                            setShowScreenshotModal(true);
                        }}
                        onUpdateSession={handleUpdateNote}
                    />
                </div>
            </div>

            <PhotoGalleryModal
                isOpen={showPhotoGallery}
                onClose={() => setShowPhotoGallery(false)}
                photoIds={record.photos || []}
                onUploadPhoto={photos.openPhotoLibrary}
                onTakePhoto={photos.openCamera}
                onDeletePhoto={photos.handleDeletePhoto}
                overlayData={overlayData} // Pass context
            />

            <HistorySettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                record={record}
                onSave={handleUpdateRecord}
                locationHistory={savedLocations}
                onRestoreTemplate={saveTemplate}
            />
        </div>
    );
};

export default HistoryReviewView;

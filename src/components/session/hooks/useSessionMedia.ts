
import React, { useRef, useEffect } from 'react';
import { GameSession, GameTemplate } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { imageService } from '../../../services/imageService';
import { googleDriveService } from '../../../services/googleDrive';
import { UIState } from './useSessionState';
import { useSessionTranslation } from '../../../i18n/session';
import { usePhotoManager } from '../../../hooks/usePhotoManager';

interface UseSessionMediaProps {
    session: GameSession;
    template: GameTemplate;
    baseImage: string | null;
    onUpdateSession: (session: GameSession) => void;
    onUpdateTemplate: (template: GameTemplate) => void; // Added for removing image ref
    onUpdateImage: (img: string | Blob | null) => void; // Allow null to clear
    setUiState: React.Dispatch<React.SetStateAction<UIState>>;
    isEditMode: boolean; // New Prop
}

export const useSessionMedia = ({
    session,
    template,
    baseImage,
    onUpdateSession,
    onUpdateTemplate,
    onUpdateImage,
    setUiState,
    isEditMode
}: UseSessionMediaProps) => {
    const { showToast } = useToast();
    const { t } = useSessionTranslation();
    const { downloadCloudImage, isAutoConnectEnabled, isConnected, connectToCloud } = useGoogleDrive();

    // === 照片管理（委託給 usePhotoManager） ===
    const photoManager = usePhotoManager({
        contextId: session.id,
        currentPhotoIds: session.photos || [],
        onPhotosAdded: (ids, source) => {
            onUpdateSession({ ...session, photos: ids });
            if (source === 'camera') {
                // Camera capture: 開啟相簿，但不重設 galleryParams（Score Camera 依賴其持久化）
                setUiState(p => ({ ...p, isPhotoGalleryOpen: true }));
            } else {
                // Upload: 關閉分享選單，開啟相簿，重設 galleryParams
                setUiState(p => ({
                    ...p,
                    showShareMenu: false,
                    isPhotoGalleryOpen: true,
                    galleryParams: { mode: 'default' }
                }));
            }
        },
        onPhotoDeleted: (ids) => {
            onUpdateSession({ ...session, photos: ids });
            showToast({ message: t('toast_photo_deleted'), type: 'info' });
        },
        onError: (type) => {
            if (type === 'save' || type === 'compress') {
                showToast({ message: t('toast_save_failed'), type: 'error' });
            } else {
                showToast({ message: t('toast_delete_failed'), type: 'error' });
            }
        }
    });

    // === 背景圖管理（Session 專屬） ===

    // Refs for hidden inputs (background only)
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasPromptedRef = useRef(false);

    // [Logic] Auto-download background image from cloud if missing
    useEffect(() => {
        if (baseImage) return;

        const hasBackgroundDesign = !!template.globalVisuals || !!template.hasImage;
        if (!hasBackgroundDesign) return;

        if (hasPromptedRef.current) return;
        hasPromptedRef.current = true;

        const checkCloud = async () => {
            if (template.cloudImageId) {
                if (isAutoConnectEnabled && googleDriveService.isAuthorized) {
                    const imgBlob = await downloadCloudImage(template.cloudImageId);
                    if (imgBlob) {
                        onUpdateImage(imgBlob);
                        return;
                    }
                }
                // [Modified] Removed forced modal trigger on failure or missing image.
                // Users can manually trigger upload/download via the header menu.
            }
        };

        checkCloud();
    }, [baseImage, template.globalVisuals, template.hasImage, template.cloudImageId, downloadCloudImage, isAutoConnectEnabled, onUpdateImage, setUiState]);

    // [Handler] Manual Background Upload (Redirects to Scanner)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const rawUrl = ev.target?.result as string;
                // Open Scanner with this image pre-loaded AND check for fixed ratio
                setUiState(p => ({
                    ...p,
                    isScannerOpen: true,
                    scannerInitialImage: rawUrl,
                    scannerFixedRatio: template.globalVisuals?.aspectRatio // Pass Ratio
                }));
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // Reset input
    };

    // [Handler] Handle Scanner Result
    const handleScannerConfirm = async (result: { processed: string, raw: string, blob?: Blob, intent?: 'save' | 'edit_grid' }) => {
        if (result.blob) {
            onUpdateImage(result.blob);
        } else {
            // Fallback if no blob returned (shouldn't happen with updated scanner)
            const blob = await (await fetch(result.processed)).blob();
            onUpdateImage(blob);
        }

        if (result.intent === 'edit_grid') {
            // Keep scanner closed, but open Texture Mapper
            setUiState(p => ({ ...p, isScannerOpen: false, scannerInitialImage: null, isTextureMapperOpen: true }));
        } else {
            setUiState(p => ({ ...p, isScannerOpen: false, scannerInitialImage: null }));
            showToast({ message: t('toast_bg_updated'), type: 'success' });

            // [Feature] Tip for Edit Mode
            if (isEditMode) {
                setTimeout(() => {
                    showToast({ message: t('toast_edit_mode_tip'), type: 'info', duration: 5000 });
                }, 800);
            }
        }
    };

    // [Handler] Manual Cloud Download Trigger (from Modal)
    const handleCloudDownload = async () => {
        if (!template.cloudImageId) return;
        if (!isConnected) {
            const success = await connectToCloud();
            if (!success) return;
        }
        const imgBlob = await downloadCloudImage(template.cloudImageId);
        if (imgBlob) {
            onUpdateImage(imgBlob);
            setUiState(p => ({ ...p, isImageUploadModalOpen: false }));

            // [Feature] Tip for Edit Mode
            if (isEditMode) {
                setTimeout(() => {
                    showToast({ message: t('toast_edit_mode_tip'), type: 'info', duration: 5000 });
                }, 800);
            }
        }
    };

    // [Handler] Completely Remove Background
    const handleRemoveBackground = async () => {
        try {
            // 1. Delete local image from IndexedDB
            if (template.imageId) {
                await imageService.deleteImage(template.imageId);
            }

            // 2. Update Template: Clear image references
            // We keep globalVisuals so coordinates are not lost if user re-uploads later,
            // but we set hasImage to false so UI knows to switch to standard view.
            const updatedTemplate = {
                ...template,
                hasImage: false,
                imageId: undefined,
                cloudImageId: undefined
            };
            onUpdateTemplate(updatedTemplate);

            // 3. Clear Session View State
            onUpdateImage(null);

            // 4. Close Modal
            setUiState(p => ({ ...p, isImageUploadModalOpen: false }));

            showToast({ message: t('toast_bg_removed'), type: 'info' });
        } catch (e) {
            console.error("Remove background failed", e);
            showToast({ message: t('toast_remove_failed'), type: 'error' });
        }
    };

    // Triggers
    const openBackgroundUpload = () => fileInputRef.current?.click();
    const openScannerCamera = () => {
        setUiState(p => ({
            ...p,
            isScannerOpen: true,
            scannerInitialImage: null, // Open empty scanner (camera/file choice)
            scannerFixedRatio: template.globalVisuals?.aspectRatio // Pass Ratio
        }));
    };

    // Standard Camera (from Header / Gallery) — 設定 galleryParams 為 default
    const openCamera = () => {
        photoManager.openCamera();
        setUiState(p => ({
            ...p,
            galleryParams: { mode: 'default' }
        }));
    };

    // [New] Score Camera (from Toolbox) — 設定 galleryParams 為 lightbox_overlay
    const openScoreCamera = () => {
        photoManager.openCamera();
        setUiState(p => ({
            ...p,
            galleryParams: { mode: 'lightbox_overlay' }
        }));
    };

    return {
        // 照片管理（從 usePhotoManager 轉發）
        ...photoManager,
        // 覆寫 openCamera（加上 galleryParams 邏輯）
        openCamera,
        // Session 專屬
        openScoreCamera,
        // 背景圖管理
        fileInputRef,
        handleFileUpload,
        handleScannerConfirm,
        handleCloudDownload,
        handleRemoveBackground,
        openBackgroundUpload,
        openScannerCamera,
        isConnected,
    };
};

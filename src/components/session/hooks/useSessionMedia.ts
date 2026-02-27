
import React, { useRef, useEffect, useCallback } from 'react';
import { GameSession, GameTemplate } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { imageService } from '../../../services/imageService';
import { compressAndResizeImage } from '../../../utils/imageProcessing';
import { googleDriveService } from '../../../services/googleDrive';
import { UIState } from './useSessionState';
import { useSessionTranslation } from '../../../i18n/session';

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

    // Refs for hidden inputs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

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
                    isImageUploadModalOpen: false,
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

    // [Handler] Handle Camera Batch Capture (Custom CameraView)
    const handleCameraBatchCapture = async (blobs: Blob[]) => {
        if (blobs.length === 0) {
            setUiState(p => ({ ...p, isGeneralCameraOpen: false }));
            return;
        }

        // [Modified] Removed "Saving..." toast per user request

        const newPhotoIds: string[] = [];

        for (const blob of blobs) {
            try {
                // Convert to optimized blob if needed, though camera already returns jpeg 0.95
                const optimizedBlob = await compressAndResizeImage(blob, 1, 1920);
                const savedImg = await imageService.saveImage(optimizedBlob, session.id, 'session');
                newPhotoIds.push(savedImg.id);
            } catch (err) {
                console.error("Failed to save camera capture", err);
            }
        }

        if (newPhotoIds.length > 0) {
            const currentPhotos = session.photos || [];
            const updatedSession = { ...session, photos: [...currentPhotos, ...newPhotoIds] };
            onUpdateSession(updatedSession);
            // [Modified] Removed "Success" toast per user request
        }

        // Close camera and ensure gallery is open underneath
        // NOTE: We rely on the previously set galleryParams (from openScoreCamera) to persist
        // so that PhotoGalleryModal knows how to behave when it mounts/updates.
        setUiState(p => ({
            ...p,
            isGeneralCameraOpen: false,
            showShareMenu: false,
            isPhotoGalleryOpen: true,
        }));
    };

    // [Handler] Session Photo (Gallery Upload Input)
    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);

            compressAndResizeImage(objectUrl, 1, 1920)
                .then(async (compressedBlob) => {
                    try {
                        // Save directly to DB
                        const savedImg = await imageService.saveImage(compressedBlob, session.id, 'session');
                        const currentPhotos = session.photos || [];
                        const updatedSession = { ...session, photos: [...currentPhotos, savedImg.id] };
                        onUpdateSession(updatedSession);

                        // Directly open gallery view
                        setUiState(prev => ({
                            ...prev,
                            showShareMenu: false,
                            isPhotoGalleryOpen: true,
                            // Manual upload implies standard view, so reset mode
                            galleryParams: { mode: 'default' }
                        }));
                    } catch (err) {
                        console.error("Save failed", err);
                        showToast({ message: t('toast_save_failed'), type: 'error' });
                    } finally {
                        URL.revokeObjectURL(objectUrl);
                    }
                })
                .catch(err => {
                    console.error("Compression failed", err);
                    showToast({ message: t('toast_process_failed'), type: 'error' });
                    URL.revokeObjectURL(objectUrl);
                });
        }
        e.target.value = '';
    };

    // [Handler] Delete Session Photo
    const handleDeletePhoto = async (id: string) => {
        try {
            await imageService.deleteImage(id);
            const currentPhotos = session.photos || [];
            const updatedSession = { ...session, photos: currentPhotos.filter(pid => pid !== id) };
            onUpdateSession(updatedSession);
            showToast({ message: t('toast_photo_deleted'), type: 'info' });
        } catch (e) {
            console.error("Delete failed", e);
            showToast({ message: t('toast_delete_failed'), type: 'error' });
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
            isImageUploadModalOpen: false,
            isScannerOpen: true,
            scannerInitialImage: null, // Open empty scanner (camera/file choice)
            scannerFixedRatio: template.globalVisuals?.aspectRatio // Pass Ratio
        }));
    };

    // Standard Camera (from Header) - Resets mode
    const openCamera = () => {
        setUiState(p => ({
            ...p,
            isGeneralCameraOpen: true,
            // Ensure gallery is "ready" underneath
            isPhotoGalleryOpen: true,
            showShareMenu: false,
            galleryParams: { mode: 'default' } // [Reset]
        }));
    };

    // [New] Score Camera (from Toolbox) - Activates overlay mode
    const openScoreCamera = () => {
        setUiState(p => ({
            ...p,
            isGeneralCameraOpen: true,
            isPhotoGalleryOpen: true,
            showShareMenu: false,
            galleryParams: { mode: 'lightbox_overlay' } // [Active]
        }));
    };

    const openPhotoLibrary = () => galleryInputRef.current?.click();

    return {
        fileInputRef,
        photoInputRef,
        galleryInputRef,
        handleFileUpload,
        handleScannerConfirm,
        handleCameraBatchCapture, // Export this for SessionView
        handlePhotoSelect,
        handleDeletePhoto,
        handleCloudDownload,
        handleRemoveBackground,
        openBackgroundUpload,
        openScannerCamera,
        openCamera,
        openScoreCamera, // [New Export]
        openPhotoLibrary,
        isConnected
    };
};

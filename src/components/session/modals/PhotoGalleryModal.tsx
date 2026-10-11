
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Loader2, Upload, Trash2 } from 'lucide-react';
import { usePhotoImages } from '../../../hooks/usePhotoImages';
import type { LocalImage, PhotoContentIds } from '../../../types';
import PhotoLightbox from '../parts/PhotoLightbox';
import { OverlayData } from '../parts/ScoreOverlayGenerator';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';
import { useConfirm } from '../../../hooks/useConfirm';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

interface PhotoGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    photoIds: string[];
    photoContentIds?: PhotoContentIds;
    onUploadPhoto: () => void;
    onTakePhoto: () => void;
    onDeletePhoto: (id: string) => void;
    onRotatePhoto?: (image: LocalImage, expectedContentId?: string) => Promise<void>;
    overlayData?: OverlayData; // [New] Data context for lightbox overlay
    autoEnterMode?: 'default' | 'lightbox_overlay'; // [New] Mode prop
    initialPhotoId?: string | null;
    entryMode?: 'gallery' | 'direct-lightbox';
}

export interface LoadedImage {
    id: string;
    url: string;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ isOpen, onClose, photoIds, photoContentIds, onUploadPhoto, onTakePhoto, onDeletePhoto, onRotatePhoto, overlayData, autoEnterMode = 'default', initialPhotoId = null, entryMode = 'gallery' }) => {
    const { images, loading, rotatePhoto } = usePhotoImages(photoIds, photoContentIds, isOpen);
    const rotateHandlerRef = useRef(onRotatePhoto);
    useEffect(() => { rotateHandlerRef.current = onRotatePhoto; }, [onRotatePhoto]);
    const [initialIndex, setInitialIndex] = useState<number | null>(null); // Changed: Store index instead of object
    const lastViewedPhoto = useRef<string | null>(null);
    const [returnPhotoId, setReturnPhotoId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const photoButtons = useRef(new Map<string, HTMLButtonElement>());
    const rememberPhoto = useCallback((id: string) => { lastViewedPhoto.current = id; }, []);
    const { t } = useSessionTranslation();
    const { t: tCommon } = useCommonTranslation();
    const { confirm } = useConfirm();
    const isDirectLightbox = entryMode === 'direct-lightbox';

    // Image direction changes must not create/close a modal history layer.
    useEffect(() => {
        if (!isOpen) {
            setInitialIndex(null);
            lastViewedPhoto.current = null;
            setReturnPhotoId(null);
            return;
        }
        if (isDirectLightbox && initialPhotoId) {
            const selectedIndex = images.findIndex(image => image.id === initialPhotoId);
            setInitialIndex(selectedIndex >= 0 ? selectedIndex : null);
        } else if (autoEnterMode === 'lightbox_overlay' && images.length > 0) {
            setInitialIndex(0);
        }
    }, [isOpen, images, initialPhotoId, isDirectLightbox, autoEnterMode]);

    // [Logic] Unified handler for closing Lightbox
    // If in 'lightbox_overlay' mode (Score Camera), closing lightbox means finishing the task -> Close Modal.
    // Otherwise, return to Gallery Grid.
    const handleCloseLightbox = useCallback(() => {
        if (autoEnterMode === 'lightbox_overlay' || isDirectLightbox) {
            onClose();
        } else {
            setReturnPhotoId(lastViewedPhoto.current);
            setInitialIndex(null);
        }
    }, [autoEnterMode, isDirectLightbox, onClose]);

    useEffect(() => {
        if (!isOpen || initialIndex !== null || !returnPhotoId) return;
        const button = photoButtons.current.get(returnPhotoId);
        const scroll = scrollRef.current;
        if (!button || !scroll) return;
        const photoRect = button.getBoundingClientRect();
        const viewportRect = scroll.getBoundingClientRect();
        // Scroll only this album, and only far enough to reveal the viewed photo.
        if (photoRect.top < viewportRect.top) scroll.scrollTop += photoRect.top - viewportRect.top;
        else if (photoRect.bottom > viewportRect.bottom) scroll.scrollTop += photoRect.bottom - viewportRect.bottom;
        button.focus({ preventScroll: true });
    }, [isOpen, initialIndex, returnPhotoId]);

    // [Refactored] Unified Back Button Interception
    // Now photo-lightbox handles its own history entry, so photo-gallery only manages its own close logic.
    const { zIndex } = useModalBackHandler(
        isOpen,
        onClose,
        isDirectLightbox ? 'photo-direct-lightbox' : 'photo-gallery'
    );

    const handleDeletePhotoClick = async (id: string, triggerCloseLightbox?: (steps?: number) => void) => {
        const isConfirmed = await confirm({
            title: t('gallery_delete_confirm_title'),
            message: t('gallery_delete_confirm_msg'),
            confirmText: tCommon('delete'),
            isDangerous: true
        });

        if (isConfirmed) {
            if (triggerCloseLightbox) {
                // 連帶關閉確認框和大圖，一步到位退回 2 步，若在 single-shot 模式則退回 3 步以連帶關閉相簿
                if (autoEnterMode === 'lightbox_overlay') {
                    triggerCloseLightbox(3);
                } else {
                    triggerCloseLightbox(2);
                }
            }
            setInitialIndex(null);
            onDeletePhoto(id);

            // [New Logic] If in single-shot mode (toolbox camera), deletion means the task is aborted/finished.
            if (autoEnterMode === 'lightbox_overlay' || isDirectLightbox) {
                onClose();
            }
        }
    };

    // [Critical Fix] Ensure component returns null if not open
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-app-bg-deep flex flex-col animate-in fade-in duration-200"
            style={{ zIndex }}
        >
            {initialIndex !== null && images.length > 0 && (
                <PhotoLightbox
                    images={images}
                    initialIndex={initialIndex}
                    onClose={handleCloseLightbox} // Use unified handler
                    onDelete={handleDeletePhotoClick}
                    onRotate={onRotatePhoto ? id => rotatePhoto(id, (image, expectedContentId) => {
                        if (!rotateHandlerRef.current) throw new Error('Photo rotation is unavailable');
                        return rotateHandlerRef.current(image, expectedContentId);
                    }) : undefined}
                    overlayData={overlayData} // Pass the context
                    initialShowOverlay={autoEnterMode === 'lightbox_overlay'} // Enable overlay if mode matches
                    manageBackHistory={!isDirectLightbox}
                    onCurrentPhotoChange={rememberPhoto}
                />
            )}

            {/* Header */}
            <div className="safe-area-top-medium flex-none bg-modal-bg p-3 border-b border-modal-border flex items-center justify-between z-10 gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-2 bg-brand-secondary/10 rounded-lg shrink-0">
                        <ImageIcon size={20} className="text-brand-secondary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-base font-bold text-txt-title truncate">{t('gallery_title')}</h3>
                        <span className="text-[10px] text-txt-muted">{t('share_photo_count', { count: photoIds.length })}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onUploadPhoto}
                        aria-label={t('gallery_upload')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-modal-bg-elevated hover:bg-surface-hover text-txt-primary rounded-lg text-xs font-bold border border-surface-border transition-colors"
                    >
                        <Upload size={14} /> <span className="hidden sm:inline">{t('gallery_upload')}</span>
                    </button>
                    <button
                        onClick={onTakePhoto}
                        aria-label={t('gallery_camera')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary hover:bg-brand-primary-deep text-white rounded-lg text-xs font-bold shadow-md transition-colors"
                    >
                        <Camera size={14} /> <span className="hidden sm:inline">{t('gallery_camera')}</span>
                    </button>
                    <button onClick={onClose} aria-label={tCommon('close')} className="p-2 text-txt-secondary hover:text-txt-title bg-modal-bg-elevated/50 hover:bg-modal-bg-elevated rounded-full transition-colors ml-1">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Content */}
            <div ref={scrollRef} data-photo-gallery-scroll="true" className="flex-1 overflow-y-auto p-4 safe-area-bottom-padding">
                {loading && images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-txt-muted gap-2">
                        <Loader2 size={32} className="animate-spin text-brand-secondary" />
                        <span className="text-sm">{tCommon('loading')}</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1 auto-rows-fr">
                        {/* Image Tiles */}
                        {images.map((img, idx) => (
                            <button
                                key={img.id}
                                ref={button => {
                                    if (button) photoButtons.current.set(img.id, button);
                                    else photoButtons.current.delete(img.id);
                                }}
                                type="button"
                                data-photo-id={img.id}
                                aria-label={`${t('share_title')} ${idx + 1}`}
                                onClick={() => {
                                    rememberPhoto(img.id);
                                    setReturnPhotoId(null);
                                    setInitialIndex(idx);
                                }}
                                onAnimationEnd={event => {
                                    if (event.target === event.currentTarget && returnPhotoId === img.id) setReturnPhotoId(null);
                                }}
                                className={`aspect-square bg-surface-recessed rounded-lg overflow-hidden relative cursor-pointer group active:scale-95 transition-transform border border-surface-border focus-visible:ring-2 focus-visible:ring-brand-secondary ${returnPhotoId === img.id ? 'photo-return-highlight' : ''}`}
                            >
                                <img src={img.url} className="w-full h-full object-cover" alt="Session Photo" loading="lazy" />
                                <div className="absolute inset-0 bg-txt-primary/0 group-hover:bg-txt-primary/5 transition-colors" />
                            </button>
                        ))}
                    </div>
                )}

                {images.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-64 text-txt-muted gap-4">
                        <div className="w-16 h-16 rounded-full bg-surface-recessed flex items-center justify-center">
                            <ImageIcon size={32} className="opacity-50" />
                        </div>
                        <p className="text-sm">{t('gallery_empty')}</p>
                        <p className="text-xs max-w-[200px] text-center opacity-70">{t('gallery_empty_hint')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhotoGalleryModal;


import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Trash2, Maximize, Share2, ReceiptText, Loader2, Download, ChevronLeft, ChevronRight, VenetianMask, Check, EyeOff, RotateCw } from 'lucide-react';
import { isColorDark } from '../../../utils/ui';
import { useToast } from '../../../hooks/useToast';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';
import { LoadedImage } from '../modals/PhotoGalleryModal';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';
import { getTopModalId, useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { usePhotoComposition } from '../hooks/usePhotoComposition';
import { usePhotoViewerGestures } from '../hooks/usePhotoViewerGestures';
import PhotoSwipePreview from './PhotoSwipePreview';

interface PhotoLightboxProps {
    images: LoadedImage[];
    initialIndex: number;
    onClose: () => void;
    onDelete: (id: string, triggerCloseLightbox?: (steps?: number) => void) => void;
    onRotate?: (id: string) => Promise<void>;
    overlayData?: OverlayData;
    initialShowOverlay?: boolean;
    manageBackHistory?: boolean;
    onCurrentPhotoChange?: (id: string) => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ images, initialIndex, onClose, onDelete, onRotate, overlayData, initialShowOverlay = false, manageBackHistory = true, onCurrentPhotoChange }) => {
    const { t, language } = useSessionTranslation();
    const { t: tCommon } = useCommonTranslation();
    const { triggerClose } = useModalBackHandler(manageBackHistory, onClose, 'photo-lightbox');
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [showOverlay, setShowOverlay] = useState(initialShowOverlay);
    const [isRotating, setIsRotating] = useState(false);
    const rotationPending = useRef(false);

    // Anonymous Feature State
    const [isAnonPanelOpen, setIsAnonPanelOpen] = useState(false);
    const [anonymousPlayerIds, setAnonymousPlayerIds] = useState<Set<string>>(new Set());

    const rootRef = useRef<HTMLDivElement>(null);
    const generatorRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    const currentImage = images[currentIndex];

    // Prepare Data for Generator (Masking Names)
    const displayOverlayData = useMemo(() => {
        if (!overlayData) return undefined;
        return {
            ...overlayData,
            players: overlayData.players.map((p, i) => ({
                ...p,
                // If ID is in anonymous set, replace name with Player N or trigger visual mask
                isAnonymous: anonymousPlayerIds.has(p.id),
                name: anonymousPlayerIds.has(p.id) ? t('lightbox_player_n', { n: i + 1 }) : p.name
            }))
        };
    }, [overlayData, anonymousPlayerIds, language]);

    const { composedImageUrl, isGenerating } = usePhotoComposition(
        showOverlay, currentImage.url, displayOverlayData, generatorRef,
        () => {
            showToast({ message: t('share_composite_failed'), type: 'error' });
            setShowOverlay(false);
        },
    );
    const isBusy = isGenerating || isRotating;
    const {
        containerRef, transform, motion, resetView, navigate, finishSlide,
        handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleWheel,
    } = usePhotoViewerGestures({
        currentId: currentImage.id,
        imageKey: currentImage.url,
        previousId: images[currentIndex - 1]?.id,
        nextId: images[currentIndex + 1]?.id,
        busy: isBusy,
        onNavigate: id => {
            const index = images.findIndex(image => image.id === id);
            if (index >= 0) setCurrentIndex(index);
        },
        onInteract: () => { if (isAnonPanelOpen) setIsAnonPanelOpen(false); },
    });
    const controlsBusy = isBusy || motion.settling;

    useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => { onCurrentPhotoChange?.(currentImage.id); }, [currentImage.id, onCurrentPhotoChange]);

    const handleRotate = async () => {
        if (!onRotate || rotationPending.current || isGenerating || motion.settling) return;
        rotationPending.current = true;
        setIsRotating(true);
        try {
            await onRotate(currentImage.id);
        } catch (error) {
            console.error('Photo rotation failed', error);
            showToast({ message: t('lightbox_rotate_failed'), type: 'error' });
        } finally {
            rotationPending.current = false;
            setIsRotating(false);
        }
    };

    const handleShare = async () => {
        if (controlsBusy) return;
        const targetSrc = (showOverlay && composedImageUrl) ? composedImageUrl : currentImage.url;
        try {
            const response = await fetch(targetSrc);
            const blob = await response.blob();
            const mimeType = blob.type;
            let extension = 'jpg';
            if (mimeType === 'image/png') extension = 'png';

            const fileName = `score_photo_${Date.now()}.${extension}`;
            const file = new File([blob], fileName, { type: mimeType });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: t('share_title') });
            } else {
                const a = document.createElement('a');
                a.href = targetSrc;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                if (!navigator.canShare) showToast({ message: t('share_download_success'), type: 'success' });
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error("Share failed", e);
                showToast({ message: t('share_failed'), type: 'error' });
            }
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        navigate(-1);
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        navigate(1);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const topModalId = getTopModalId();
        if (topModalId && topModalId !== (manageBackHistory ? 'photo-lightbox' : 'photo-direct-lightbox')) return;
        if (event.key === 'Tab' && !event.defaultPrevented) {
            const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
                .filter(button => button.getClientRects().length > 0);
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (first && (event.target === event.currentTarget
                || event.target === (event.shiftKey ? first : last))) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
            return;
        }
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
            || (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        navigate(event.key === 'ArrowLeft' ? -1 : 1);
    };

    const toggleAnonymous = (playerId: string) => {
        setAnonymousPlayerIds(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) {
                next.delete(playerId);
            } else {
                next.add(playerId);
            }
            return next;
        });
    };

    const handleToggleOverlay = () => {
        if (showOverlay) {
            setShowOverlay(false);
        } else {
            // If panel is open when showing score, close it for better view
            setIsAnonPanelOpen(false);
            setShowOverlay(true);
        }
    };

    const currentDisplayImage = (showOverlay && composedImageUrl) ? composedImageUrl : currentImage.url;

    return (
        <div ref={rootRef} role="dialog" aria-modal="true" aria-label={t('gallery_title')} tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[100] bg-app-bg flex flex-col animate-in fade-in duration-300 outline-none">

            {/* Hidden Generator */}
            {showOverlay && displayOverlayData && (
                <div style={{ position: 'absolute', top: 0, left: '-9999px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                    <ScoreOverlayGenerator
                        ref={generatorRef}
                        imageSrc={currentImage.url}
                        data={displayOverlayData}
                    />
                </div>
            )}

            {/* Header Toolbar */}
            <div className="safe-area-top-padding flex-none flex justify-between items-center p-4 bg-surface-recessed border-b border-surface-border z-10 min-h-16">
                <button onClick={onClose} aria-label={tCommon('close')} className="p-2 bg-surface-recessed rounded-full text-txt-muted hover:text-txt-title border border-surface-border transition-colors">
                    <X size={24} />
                </button>

                {images.length > 1 && (
                    <div className="text-txt-title text-sm font-bold bg-surface-recessed/80 px-3 py-1 rounded-full border border-surface-border">
                        {currentIndex + 1} / {images.length}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {onRotate && (
                        <button type="button" onClick={handleRotate} disabled={controlsBusy}
                            title={t('lightbox_rotate')} aria-label={t('lightbox_rotate')}
                            className="p-2 bg-surface-recessed rounded-full text-txt-muted hover:text-txt-title border border-surface-border transition-colors active:scale-95 disabled:opacity-40">
                            {isRotating ? <Loader2 size={24} className="animate-spin" /> : <RotateCw size={24} />}
                        </button>
                    )}
                    <button onClick={() => onDelete(currentImage.id, triggerClose)} aria-label={tCommon('delete')} disabled={isRotating || motion.settling} className="p-2 bg-surface-recessed rounded-full text-status-danger hover:text-status-danger/80 border border-surface-border transition-colors active:scale-95 disabled:opacity-40">
                        <Trash2 size={24} />
                    </button>
                    <button onClick={handleShare} aria-label={tCommon(typeof navigator.share === 'function' ? 'share' : 'download')} disabled={controlsBusy} className="p-2 bg-surface-recessed rounded-full text-brand-secondary hover:text-brand-secondary/80 border border-surface-border transition-colors active:scale-95 disabled:opacity-40">
                        {typeof navigator.share === 'function' ? <Share2 size={24} /> : <Download size={24} />}
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                data-mobile-zoom-ignore="true"
                className="flex-1 w-full min-h-0 overflow-hidden touch-none flex items-center justify-center bg-black relative"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                onMouseMove={handlePointerMove}
                onTouchMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchEnd={handlePointerUp}
                onTouchCancel={handlePointerCancel}
                onMouseLeave={handlePointerUp}
                onWheel={handleWheel}
            >
                {isBusy ? (
                    <div className="flex flex-col items-center gap-3 text-brand-primary z-20">
                        <Loader2 size={48} className="animate-spin" />
                        <span className="text-sm font-bold animate-pulse">{t(isRotating ? 'lightbox_rotating' : 'lightbox_generating')}</span>
                    </div>
                ) : (
                    <PhotoSwipePreview
                        currentSrc={currentDisplayImage}
                        images={images}
                        currentIndex={currentIndex}
                        offset={motion.offset}
                        settling={motion.settling}
                        transform={transform}
                        onSettled={() => finishSlide(true)}
                    />
                )}

                {/* Navigation Arrows */}
                {currentIndex > 0 && transform.scale <= 1.05 && (
                    <button onClick={handlePrev} aria-label={t('lightbox_previous_photo')} disabled={controlsBusy} className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 hidden sm:block disabled:opacity-40">
                        <ChevronLeft size={32} />
                    </button>
                )}
                {currentIndex < images.length - 1 && transform.scale <= 1.05 && (
                    <button onClick={handleNext} aria-label={t('lightbox_next_photo')} disabled={controlsBusy} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 hidden sm:block disabled:opacity-40">
                        <ChevronRight size={32} />
                    </button>
                )}
            </div>

            {/* Anonymous Settings Panel (Floating) */}
            {isAnonPanelOpen && overlayData && (
                <div className="absolute left-4 right-4 bg-modal-bg-elevated/95 backdrop-blur-md border border-surface-border rounded-2xl p-4 z-30 shadow-2xl animate-in slide-in-from-bottom-5" style={{ bottom: 'calc(6rem + var(--app-safe-area-bottom))' }}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-txt-muted uppercase">{t('lightbox_anon_hint')}</span>
                        <button onClick={() => setIsAnonPanelOpen(false)} aria-label={tCommon('close')} className="p-1 bg-surface-recessed rounded-full text-txt-secondary"><X size={14} /></button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {overlayData.players.map((p, i) => {
                            const isHidden = anonymousPlayerIds.has(p.id);
                            const playerColor = p.color === 'transparent' ? 'var(--c-txt-muted)' : p.color;
                            const isDark = isColorDark(playerColor);

                            return (
                                <button
                                    key={p.id}
                                    onClick={() => toggleAnonymous(p.id)}
                                    className={`
                                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0 min-w-[100px]
                                  ${isHidden
                                            ? 'bg-surface-recessed border-surface-border text-txt-muted opacity-70'
                                            : 'border-transparent shadow-md'
                                        }
                              `}
                                    style={!isHidden ? { backgroundColor: playerColor, color: isDark ? 'white' : 'black' } : {}}
                                >
                                    {isHidden ? <EyeOff size={14} /> : <Check size={14} />}
                                    <span className={`text-sm font-bold truncate ${isHidden ? 'line-through' : ''}`}>
                                        {p.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Footer Controls - Reorganized */}
            <div className="safe-area-bottom-medium flex-none px-4 py-3 bg-surface-recessed border-t border-surface-border z-20 flex items-center justify-between min-h-20 gap-4">

                {/* Left Group: Config & Show */}
                <div className="flex items-center gap-2">
                    {overlayData && (
                        <>
                            <button
                                onClick={() => setIsAnonPanelOpen(!isAnonPanelOpen)}
                                disabled={controlsBusy}
                                className={`p-3 rounded-xl border transition-all active:scale-95 ${isAnonPanelOpen ? 'bg-surface-recessed-hover border-brand-primary text-txt-title' : 'bg-surface-recessed border-surface-border text-txt-muted'}`}
                                title={t('lightbox_anon_setting')}
                                aria-label={t('lightbox_anon_setting')}
                            >
                                <VenetianMask size={20} />
                            </button>

                            <button
                                onClick={handleToggleOverlay}
                                disabled={controlsBusy}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all active:scale-95 font-bold text-sm min-w-[110px] justify-center
                            ${showOverlay
                                        ? 'bg-brand-primary text-txt-on-dark border-brand-primary shadow-lg shadow-brand-primary/20'
                                        : 'bg-surface-recessed text-brand-primary border-surface-border hover:bg-surface-recessed-hover'
                                    }`}
                            >
                                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ReceiptText size={18} />}
                                <span>{showOverlay ? t('lightbox_hide_score') : t('lightbox_show_score')}</span>
                            </button>
                        </>
                    )}
                </div>

                {/* Center: Reset View */}
                <div className="flex-1 flex justify-center">
                    <button
                        onClick={resetView}
                        className="p-3 rounded-full bg-surface-recessed text-txt-muted border border-surface-border active:scale-95 hover:text-txt-title"
                        title={t('lightbox_view_reset')}
                        aria-label={t('lightbox_view_reset')}
                    >
                        <Maximize size={20} />
                    </button>
                </div>

                {/* Right Group: Empty Spacer (Buttons moved to Header) */}
                <div className="w-[80px]"></div>
            </div>
        </div>
    );
};

export default PhotoLightbox;

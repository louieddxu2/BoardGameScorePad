
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ContentLayout, Rect } from '../../types';
import { X, RotateCcw, MousePointerClick } from 'lucide-react';
import { cropImageToDataUrl } from '../../utils/imageProcessing';
import { calculateDynamicFontSize } from '../../utils/dynamicLayout';
import { useColumnEditorTranslation } from '../../i18n/column_editor'; // New Import

interface LayoutEditorProps {
    initialLayout?: ContentLayout;
    onSave: (layout: ContentLayout | undefined) => void;
    onCancel: () => void;
    color: string;
    aspectRatio?: number;
    baseImage?: string; // New: Full score sheet image
    cellRect?: Rect;    // New: Coordinates to crop
}

const LayoutEditor: React.FC<LayoutEditorProps> = ({ initialLayout, onSave, onCancel, color, aspectRatio, baseImage, cellRect }) => {
    const { t } = useColumnEditorTranslation(); // Use New Hook
    const [rect, setRect] = useState<ContentLayout | null>(initialLayout || null);
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null); // New ref for the scrollable area
    const [isDrawing, setIsDrawing] = useState(false);
    const startPos = useRef<{ x: number, y: number } | null>(null);

    // --- Load Background Image ---
    useEffect(() => {
        if (baseImage && cellRect) {
            cropImageToDataUrl(baseImage, cellRect).then(setBgUrl);
        }
    }, [baseImage, cellRect]);

    // --- Gesture Locking ---
    // Prevent browser zoom gestures specifically within the drawing area
    useEffect(() => {
        const element = scrollAreaRef.current;
        if (!element) return;

        const handleTouchMove = (e: TouchEvent) => {
            // If 2+ fingers (pinch), prevent default to stop browser zoom
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        const handleWheel = (e: WheelEvent) => {
            // Prevent Ctrl+Wheel zoom
            if (e.ctrlKey) {
                e.preventDefault();
            }
        };

        // Passive: false is required to use preventDefault
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const getPercentagePos = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const bounds = containerRef.current.getBoundingClientRect();

        // Calculate relative to the container (which now tightly wraps the image)
        let x = ((clientX - bounds.left) / bounds.width) * 100;
        let y = ((clientY - bounds.top) / bounds.height) * 100;

        // Clamp
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        // Round to 3 decimal places
        x = Math.round(x * 1000) / 1000;
        y = Math.round(y * 1000) / 1000;

        return { x, y };
    }, []);

    const handleStart = (clientX: number, clientY: number) => {
        const pos = getPercentagePos(clientX, clientY);
        setIsDrawing(true);
        startPos.current = pos;
        setRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    };

    // Global mouse/touch handlers to ensure drag continues outside the box
    useEffect(() => {
        if (!isDrawing) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            if (!startPos.current) return;
            const current = getPercentagePos(clientX, clientY);

            const x = Math.min(startPos.current.x, current.x);
            const y = Math.min(startPos.current.y, current.y);
            let width = Math.abs(current.x - startPos.current.x);
            let height = Math.abs(current.y - startPos.current.y);

            // Round width/height as well
            width = Math.round(width * 1000) / 1000;
            height = Math.round(height * 1000) / 1000;

            setRect({ x, y, width, height });
        };

        const handleEnd = () => {
            setIsDrawing(false);
            startPos.current = null;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDrawing, getPercentagePos]);

    const handleReset = () => {
        setRect(null); // Reset to full (undefined layout)
    };

    // Fallback aspect ratio logic (only used when NO image)
    const targetAspectRatio = useMemo(() => {
        if (cellRect && cellRect.width && cellRect.height) {
            return cellRect.width / cellRect.height;
        }
        return aspectRatio || 3;
    }, [cellRect, aspectRatio]);

    // [Dynamic Layout] Calculate font size for the preview text "123"
    const previewText = "123";
    const dynamicFontSize = calculateDynamicFontSize([previewText]);

    return (
        <div
            className="modal-backdrop z-[100]"
            onClick={(e) => {
                // Allow clicking backdrop to cancel (like standard modal behavior)
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            {/* Fixed Height Modal */}
            <div
                className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <MousePointerClick size={20} className="text-emerald-500" />
                        {t('layout_title')}
                    </h3>
                    <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col bg-slate-800/50 relative">
                    <div className="flex-none p-4 pb-0 text-center z-10">
                        <p className="text-sm text-slate-400">
                            {t('layout_desc')}<br />
                            <span className="text-xs opacity-70">{t('layout_hint')}</span>
                        </p>
                    </div>

                    {/* 
               Scrollable Area: 
               We center the content flex-wise. 
               The content (image wrapper) will determine its own size based on constraints.
            */}
                    <div
                        ref={scrollAreaRef}
                        className="flex-1 w-full min-h-0 flex items-center justify-center p-4 cursor-crosshair touch-none select-none overflow-hidden"
                        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
                        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
                    >
                        {/* 
                   Wrapper Logic:
                   1. fit-content: Ensures the div is exactly the size of the image.
                   2. relative: Coordinates for overlays are relative to this box.
                   3. line-height: 0: Removes bottom gap for inline images.
                */}
                        <div
                            ref={containerRef}
                            className="relative shadow-inner border-4 border-slate-700 rounded-lg overflow-hidden"
                            style={{
                                width: 'fit-content',
                                height: 'fit-content',
                                lineHeight: 0,
                                // Fallback aspect ratio only if no image is loaded yet
                                aspectRatio: bgUrl ? undefined : `${targetAspectRatio}`,
                                backgroundColor: bgUrl ? 'transparent' : 'white'
                            }}
                        >
                            {bgUrl ? (
                                <img
                                    src={bgUrl}
                                    className="block object-contain"
                                    // Constraints logic:
                                    // Max Height: Modal height (85vh) - Headers/Footers/Padding (~180px)
                                    // Max Width: Modal width (limited by max-w-lg) - Padding
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: 'calc(85vh - 200px)', // Key constraint to ensure it fits in modal
                                        display: 'block'
                                    }}
                                    alt="Reference"
                                    draggable={false}
                                />
                            ) : (
                                // Fallback Box (No Image)
                                <div className="w-full h-full min-w-[200px] min-h-[100px] flex items-center justify-center">
                                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                                        style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                    </div>
                                    <span className="text-slate-300 opacity-50 font-bold text-4xl">123</span>
                                </div>
                            )}

                            {/* Overlay: Selection Box */}
                            {rect ? (
                                <div
                                    className="absolute bg-emerald-500/20 border-2 border-emerald-600 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)] z-20"
                                    style={{
                                        left: `${rect.x}%`,
                                        top: `${rect.y}%`,
                                        width: `${rect.width}%`,
                                        height: `${rect.height}%`,
                                        containerType: 'size', // [Dynamic Layout] Enable Container Queries
                                    } as React.CSSProperties}
                                >
                                    <span
                                        className="text-emerald-500 font-bold select-none drop-shadow-md"
                                        style={{
                                            fontSize: dynamicFontSize, // [Dynamic Layout] Apply calculated size
                                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                        }}
                                    >
                                        {previewText}
                                    </span>
                                    <div className="absolute -bottom-6 left-0 bg-slate-800 text-white text-[10px] px-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                        {Math.round(rect.width)}% x {Math.round(rect.height)}%
                                    </div>
                                </div>
                            ) : (
                                // Overlay: Full Coverage Hint
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                    {/* Only show "123" here if image exists, to show context */}
                                    {bgUrl && <span className="font-bold text-4xl select-none text-slate-900/50">123</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center shrink-0">
                    <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                        <RotateCcw size={16} /> {t('layout_reset')}
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-bold">{t('layout_cancel')}</button>
                        <button onClick={() => onSave(rect || undefined)} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/50 flex items-center gap-2">
                            {t('layout_save')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LayoutEditor;

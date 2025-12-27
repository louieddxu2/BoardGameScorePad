
import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Download, Share, Loader2, Image as ImageIcon, LayoutPanelLeft, ZoomIn, RotateCcw } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { GameSession, GameTemplate } from '../../../types';
import { ScreenshotLayout } from '../hooks/useSessionState';
import ScreenshotView from '../parts/ScreenshotView';
import { useToast } from '../../../hooks/useToast';
import { getTouchDistance } from '../../../utils/ui';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'full' | 'simple';
  session: GameSession;
  template: GameTemplate;
  zoomLevel: number;
  layout: ScreenshotLayout | null;
  baseImage?: string; 
}

interface SnapshotCache {
  blob: Blob | null;
  url: string | null;
}

const ScreenshotModal: React.FC<ScreenshotModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  session,
  template,
  zoomLevel,
  layout,
  baseImage
}) => {
  const [activeMode, setActiveMode] = useState<'full' | 'simple'>(initialMode);
  
  // Cache state for both modes
  const [snapshots, setSnapshots] = useState<{
    full: SnapshotCache;
    simple: SnapshotCache;
  }>({
    full: { blob: null, url: null },
    simple: { blob: null, url: null }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  // --- Pan & Zoom State ---
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPinchDist = useRef(0);
  const startPinchScale = useRef(1);

  // Reset View Helper
  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  
  // State Synchronization and Cleanup
  useEffect(() => {
    if (isOpen) {
        // Force sync state with prop when opening
        setActiveMode(initialMode);
        resetView();
    } else {
        // Cleanup when closing
        if (snapshots.full.url) URL.revokeObjectURL(snapshots.full.url);
        if (snapshots.simple.url) URL.revokeObjectURL(snapshots.simple.url);
        
        setSnapshots({
            full: { blob: null, url: null },
            simple: { blob: null, url: null }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  // Effect: Generate image for active mode if missing
  useEffect(() => {
    if (!isOpen) return;

    const generateCurrentMode = async () => {
        if (snapshots[activeMode].url) return;

        setIsGenerating(true);
        resetView(); // Reset zoom when switching modes or regenerating
        
        // Wait for DOM to render. 
        const renderDelay = baseImage ? 1000 : 300;
        await new Promise(r => setTimeout(r, renderDelay));

        const targetId = `screenshot-target-${activeMode}`;
        const target = document.getElementById(targetId);

        if (!target || target.offsetWidth === 0) {
             setIsGenerating(false);
             return;
        }

        try {
            const fontStyles = `normal ${16 * zoomLevel}px Inter`;
            await document.fonts.load(fontStyles);

            const blob = await toBlob(target, {
                backgroundColor: baseImage ? '#ffffff' : '#0f172a', 
                pixelRatio: 2,
                width: target.offsetWidth,
                height: target.offsetHeight,
                style: { 
                    transform: 'none',
                    fontFamily: 'Inter, sans-serif'
                }
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                setSnapshots(prev => ({
                    ...prev,
                    [activeMode]: { blob, url }
                }));
            }
        } catch (err) {
            console.error("Screenshot generation failed", err);
            showToast({ message: "圖片產生失敗，請重試", type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    generateCurrentMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeMode]);

  // --- Interaction Handlers ---

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Only allow drag if we have an image
    if (!snapshots[activeMode].url) return;
    
    e.stopPropagation(); 
    isDragging.current = true;

    const isTouch = 'touches' in e;
    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
        // Pinch Start
        startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
        startPinchScale.current = transform.scale;
        isDragging.current = false; // Switch to zoom mode, disable pan
    } else {
        // Pan Start
        const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        lastPos.current = { x: clientX, y: clientY };
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!snapshots[activeMode].url) return;
    e.stopPropagation();
    const scaleChange = -e.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + scaleChange)));
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  // Attach global move/up listeners to window to handle dragging outside container
  useEffect(() => {
    if (!isOpen) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current && !('touches' in e && e.touches.length === 2)) return;
        
        // CRITICAL: Prevent browser zoom/scroll
        if (e.cancelable) e.preventDefault();

        if ('touches' in e && e.touches.length === 2) {
            // Pinch Zoom
            const dist = getTouchDistance(e.touches);
            if (startPinchDist.current > 0) {
                const scaleFactor = dist / startPinchDist.current;
                const newScale = Math.max(0.1, Math.min(5, startPinchScale.current * scaleFactor));
                setTransform(prev => ({ ...prev, scale: newScale }));
            }
        } else if (isDragging.current) {
            // Pan
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            
            const dx = clientX - lastPos.current.x;
            const dy = clientY - lastPos.current.y;
            
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastPos.current = { x: clientX, y: clientY };
        }
    };

    const onUp = () => {
        isDragging.current = false;
        startPinchDist.current = 0;
    };

    // Use { passive: false } to allow preventDefault inside touchmove
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    
    return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
    };
  }, [isOpen]);


  const handleCopy = async () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentBlob })]);
      showToast({ message: "已複製到剪貼簿", type: 'success' });
    } catch (err) {
      console.error(err);
      showToast({ message: "複製失敗，請嘗試下載", type: 'error' });
    }
  };

  const handleDownload = () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_${activeMode}_${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ message: "下載已開始", type: 'success' });
  };

  const handleShare = async () => {
    const currentBlob = snapshots[activeMode].blob;
    if (!currentBlob) return;
    try {
      const file = new File([currentBlob], `${template.name}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: template.name,
          text: `這是我們玩《${template.name}》的分數！`
        });
      } else {
        showToast({ message: "您的瀏覽器不支援直接分享圖片", type: 'warning' });
      }
    } catch (err) {
      console.log('Share canceled or failed', err);
    }
  };

  if (!isOpen) return null;

  const currentPreviewUrl = snapshots[activeMode].url;
  const showLoading = isGenerating && !currentPreviewUrl; 

  return (
    <div 
        className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
    >
      
      {/* Hidden Render Targets */}
      <div style={{ position: 'fixed', left: '-200vw', top: 0, opacity: 0, pointerEvents: 'none' }}>
         <ScreenshotView 
            id="screenshot-target-full"
            className="absolute top-0 left-0"
            session={session}
            template={template}
            zoomLevel={zoomLevel}
            mode="full"
            layout={layout}
            baseImage={baseImage}
         />
         <ScreenshotView 
            id="screenshot-target-simple"
            className="absolute top-0 left-0"
            session={session}
            template={template}
            zoomLevel={zoomLevel}
            mode="simple"
            layout={layout}
            baseImage={baseImage}
         />
      </div>

      {/* Main Modal Container */}
      <div 
        className="bg-slate-900 w-[95vw] h-[90vh] max-w-6xl rounded-2xl shadow-2xl border border-slate-800 flex flex-col relative"
        onClick={e => e.stopPropagation()} 
      >
        
        {/* Header */}
        <div className="flex-none bg-slate-800 px-4 py-3 rounded-t-2xl border-b border-slate-700 flex items-center justify-between z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Share size={20} className="text-emerald-500"/> 分享結果
            </h3>
            
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button 
                    onClick={() => setActiveMode('full')}
                    disabled={showLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeMode === 'full' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <ImageIcon size={14} /> 完整版
                </button>
                <button 
                    onClick={() => setActiveMode('simple')}
                    disabled={showLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeMode === 'simple' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <LayoutPanelLeft size={14} /> 簡潔版
                </button>
            </div>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Preview Area (Zoomable) */}
        <div className="flex-1 min-h-0 bg-slate-950 relative flex flex-col z-0 overflow-hidden">
            <div 
                ref={containerRef}
                className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] touch-none"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                onWheel={handleWheel}
                onDoubleClick={resetView}
            >
                {showLoading ? (
                    <div className="flex flex-col items-center gap-4 text-emerald-500 animate-in fade-in zoom-in duration-300">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
                            <Loader2 size={48} className="animate-spin relative z-10" />
                        </div>
                        <span className="text-sm font-bold animate-pulse tracking-wider">正在繪製圖片...</span>
                    </div>
                ) : currentPreviewUrl ? (
                    <div
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                            willChange: 'transform',
                            cursor: isDragging.current ? 'grabbing' : 'grab'
                        }}
                        className="max-w-full max-h-full flex items-center justify-center"
                    >
                        <img 
                            src={currentPreviewUrl} 
                            alt="Preview" 
                            className="max-w-[90%] max-h-[90%] w-auto h-auto object-contain rounded-lg shadow-2xl border border-slate-800 pointer-events-none select-none" 
                            draggable={false}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-red-400 text-sm border border-red-900/50 bg-red-900/10 px-4 py-2 rounded-lg">預覽載入失敗</span>
                        <button onClick={() => { setSnapshots(p => ({...p, [activeMode]: {url:null, blob:null}})); setActiveMode(m => m); }} className="text-xs text-slate-500 underline">重試</button>
                    </div>
                )}

                {/* Reset View Button Overlay */}
                {currentPreviewUrl && !showLoading && (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0) && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); resetView(); }}
                        className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur text-white p-2 rounded-lg border border-slate-700 shadow-lg hover:bg-slate-700 transition-all active:scale-95"
                        title="重置視角"
                    >
                        <RotateCcw size={16} />
                    </button>
                )}
                {/* View Hint */}
                {currentPreviewUrl && !showLoading && transform.scale === 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur text-white/70 px-3 py-1 rounded-full text-xs pointer-events-none opacity-50">
                        可縮放移動 • 雙擊還原
                    </div>
                )}
            </div>
        </div>

        {/* Actions Footer */}
        <div className="flex-none p-4 bg-slate-800 rounded-b-2xl border-t border-slate-700 flex justify-center gap-4 z-10">
            <button onClick={handleCopy} disabled={showLoading} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Copy size={18} className="text-emerald-400" />
                <span className="font-bold">複製</span>
            </button>
            <button onClick={handleDownload} disabled={showLoading} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Download size={18} className="text-sky-400" />
                <span className="font-bold">下載</span>
            </button>
            <button onClick={handleShare} disabled={showLoading} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Share size={18} className="text-indigo-400" />
                <span className="font-bold">分享</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotModal;

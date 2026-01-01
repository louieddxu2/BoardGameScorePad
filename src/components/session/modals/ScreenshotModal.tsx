import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Copy, Download, Share, Loader2, Image as ImageIcon, LayoutPanelLeft } from 'lucide-react';
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

const PIXEL_RATIO = 2; // Generate image at 2x resolution for sharpness

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
  
  const [snapshots, setSnapshots] = useState<{
    full: SnapshotCache;
    simple: SnapshotCache;
  }>({
    full: { blob: null, url: null },
    simple: { blob: null, url: null }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  // --- Preview State ---
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPinchDist = useRef(0);
  const startPinchScale = useRef(1);

  // --- Reset / Fit Logic ---
  const fitToScreen = useCallback(() => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return;

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;

      // Adjust for pixel ratio to get logical dimensions
      const logicalImgW = (img.naturalWidth || img.width) / PIXEL_RATIO;
      const logicalImgH = (img.naturalHeight || img.height) / PIXEL_RATIO;

      if (logicalImgW === 0 || logicalImgH === 0 || containerW === 0 || containerH === 0) return;

      const scale = Math.min(containerW / logicalImgW, containerH / logicalImgH);

      // Center the image
      const x = (containerW - logicalImgW * scale) / 2;
      const y = (containerH - logicalImgH * scale) / 2;

      setTransform({ x, y, scale });
  }, []);

  const handleImageLoad = () => {
      requestAnimationFrame(() => fitToScreen());
  };

  useEffect(() => {
      const container = containerRef.current;
      if (!container || !isOpen) return;

      const observer = new ResizeObserver(() => {
          if (snapshots[activeMode].url) {
              requestAnimationFrame(() => fitToScreen());
          }
      });
      observer.observe(container);
      return () => observer.disconnect();
  }, [isOpen, activeMode, snapshots, fitToScreen]);

  useEffect(() => {
    if (isOpen) {
        setActiveMode(initialMode);
        setTransform({ x: 0, y: 0, scale: 1 });
    } else {
        if (snapshots.full.url) URL.revokeObjectURL(snapshots.full.url);
        if (snapshots.simple.url) URL.revokeObjectURL(snapshots.simple.url);
        
        setSnapshots({
            full: { blob: null, url: null },
            simple: { blob: null, url: null }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  // --- Generation Logic ---
  useEffect(() => {
    if (!isOpen) return;

    const generateCurrentMode = async () => {
        if (snapshots[activeMode].url) return;

        setIsGenerating(true);
        
        const renderDelay = baseImage ? 800 : 300;
        await new Promise(r => setTimeout(r, renderDelay));

        const targetId = `screenshot-target-${activeMode}`;
        const targetWrapper = document.getElementById(targetId);

        if (!targetWrapper) {
             setIsGenerating(false);
             return;
        }

        try {
            const width = targetWrapper.offsetWidth;
            const height = targetWrapper.offsetHeight;

            const blob = await toBlob(targetWrapper, {
                backgroundColor: baseImage ? '#ffffff' : '#0f172a', 
                pixelRatio: PIXEL_RATIO, 
                width: width,
                height: height,
                style: { 
                    transform: 'none',
                    margin: '0',
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
    if (!snapshots[activeMode].url) return;
    e.stopPropagation(); 
    e.preventDefault(); 

    const isTouch = 'touches' in e;
    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
        startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
        startPinchScale.current = transform.scale;
        isDragging.current = false;
    } else {
        isDragging.current = true;
        const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        lastPos.current = { x: clientX, y: clientY };
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!snapshots[activeMode].url || !containerRef.current) return;
    e.stopPropagation();
    
    const scaleChange = -e.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + scaleChange)));
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  useEffect(() => {
    if (!isOpen) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging.current && !('touches' in e && e.touches.length === 2)) return;
        if (e.cancelable) e.preventDefault();

        if ('touches' in e && e.touches.length === 2) {
            const dist = getTouchDistance(e.touches);
            if (startPinchDist.current > 0) {
                const scaleFactor = dist / startPinchDist.current;
                const newScale = Math.max(0.1, Math.min(5, startPinchScale.current * scaleFactor));
                
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const cx = rect.width / 2;
                    const cy = rect.height / 2;
                    const newX = cx - (cx - transform.x) * (newScale / transform.scale);
                    const newY = cy - (cy - transform.y) * (newScale / transform.scale);
                    setTransform({ x: newX, y: newY, scale: newScale });
                }
            }
        } else if (isDragging.current) {
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
  }, [isOpen, transform]);


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
      
      {/* 
        Hidden Render Targets 
        - Position: Fixed off-screen (-10000px).
        - Width: max-content to wrap content tightly without extra whitespace.
        - Zoom: Pass zoomLevel=1 to ensure standard 100% scale capture regardless of UI zoom.
      */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
         <div id="screenshot-target-full" style={{ display: 'inline-block', width: 'max-content' }}>
            <ScreenshotView 
                session={session}
                template={template}
                zoomLevel={1} 
                mode="full"
                layout={layout}
                baseImage={baseImage}
            />
         </div>
         <div id="screenshot-target-simple" style={{ display: 'inline-block', width: 'max-content' }}>
            <ScreenshotView 
                session={session}
                template={template}
                zoomLevel={1} 
                mode="simple"
                layout={layout}
                baseImage={baseImage}
            />
         </div>
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
                className="flex-1 w-full h-full relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] touch-none cursor-grab active:cursor-grabbing"
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                onWheel={handleWheel}
                onDoubleClick={fitToScreen}
            >
                {showLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-emerald-500 animate-in fade-in zoom-in duration-300 pointer-events-none">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
                            <Loader2 size={48} className="animate-spin relative z-10" />
                        </div>
                        <span className="text-sm font-bold animate-pulse tracking-wider">正在繪製圖片...</span>
                    </div>
                ) : currentPreviewUrl ? (
                    <img 
                        ref={imgRef}
                        src={currentPreviewUrl} 
                        alt="Preview" 
                        onLoad={handleImageLoad}
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: 'top left',
                            transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                            willChange: 'transform',
                            width: `${(imgRef.current?.naturalWidth || 0) / PIXEL_RATIO}px`,
                            height: `${(imgRef.current?.naturalHeight || 0) / PIXEL_RATIO}px`,
                        }}
                        className="absolute top-0 left-0 block pointer-events-none select-none shadow-2xl origin-top-left"
                        draggable={false}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <span className="text-red-400 text-sm border border-red-900/50 bg-red-900/10 px-4 py-2 rounded-lg">預覽載入失敗</span>
                        <button onClick={() => { setSnapshots(p => ({...p, [activeMode]: {url:null, blob:null}})); setActiveMode(m => m); }} className="text-xs text-slate-500 underline pointer-events-auto">重試</button>
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
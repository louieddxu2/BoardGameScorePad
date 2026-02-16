
import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, ZoomIn, ZoomOut, Maximize, Share2, ReceiptText, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTouchDistance } from '../../../utils/ui';
import { useToast } from '../../../hooks/useToast';
import { toBlob } from 'html-to-image';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';
import { LoadedImage } from '../modals/PhotoGalleryModal';

interface PhotoLightboxProps {
  images: LoadedImage[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  overlayData?: OverlayData; // Optional, only needed if overlay feature is used
  initialShowOverlay?: boolean; // [New]
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ images, initialIndex, onClose, onDelete, overlayData, initialShowOverlay = false }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showOverlay, setShowOverlay] = useState(initialShowOverlay);
  const [isGenerating, setIsGenerating] = useState(false);
  const [composedImageUrl, setComposedImageUrl] = useState<string | null>(null);
  
  // Swipe State
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const generatorRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPinchDist = useRef(0);
  const startPinchScale = useRef(1);

  const currentImage = images[currentIndex];

  // Reset transform when index changes
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
    // [Modified] Do NOT reset showOverlay here. Persist the toggle state (or initial prop state) across images.
    setComposedImageUrl(null);
    setSwipeOffset(0);
  }, [currentIndex]);

  // Cleanup object URL
  useEffect(() => {
      return () => {
          if (composedImageUrl) URL.revokeObjectURL(composedImageUrl);
      };
  }, [composedImageUrl]);

  // --- Generation Logic ---
  useEffect(() => {
      if (showOverlay && overlayData && !composedImageUrl && !isGenerating) {
          const generate = async () => {
              setIsGenerating(true);
              // Wait for DOM render & Image load inside generator
              await new Promise(r => setTimeout(r, 800)); 
              
              if (generatorRef.current) {
                  try {
                      const blob = await toBlob(generatorRef.current, {
                          pixelRatio: 1, // Already set to 1080px width
                          backgroundColor: '#0f172a',
                          skipFonts: true 
                      });
                      if (blob) {
                          setComposedImageUrl(URL.createObjectURL(blob));
                      } else {
                          throw new Error("Blob generation returned null");
                      }
                  } catch (e) {
                      console.error("Overlay generation failed", e);
                      showToast({ message: "合成圖片失敗，請重試", type: 'error' });
                      setShowOverlay(false); // Revert
                  }
              }
              setIsGenerating(false);
          };
          generate();
      }
  }, [showOverlay, overlayData, composedImageUrl, isGenerating, showToast]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopPropagation();

    const isTouch = 'touches' in e;
    
    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
        // Double finger -> Pinch Zoom
        startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
        startPinchScale.current = transform.scale;
        isDragging.current = false;
    } else {
        // Single finger -> Pan or Swipe
        isDragging.current = true;
        const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        lastPos.current = { x: clientX, y: clientY };
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopPropagation();

    // Pinch Zoom Logic
    if ('touches' in e && e.touches.length === 2) {
        const dist = getTouchDistance(e.touches);
        if (startPinchDist.current > 0) {
            const scaleFactor = dist / startPinchDist.current;
            const newScale = Math.max(1, Math.min(5, startPinchScale.current * scaleFactor));
            setTransform(prev => ({ ...prev, scale: newScale }));
        }
        return;
    } 
    
    // Drag Logic
    if (isDragging.current) {
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        
        const dx = clientX - lastPos.current.x;
        const dy = clientY - lastPos.current.y;
        
        // Mode A: Zoomed In -> Pan
        if (transform.scale > 1.05) {
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        } 
        // Mode B: Zoomed Out -> Swipe
        else {
            setSwipeOffset(prev => prev + dx);
        }

        lastPos.current = { x: clientX, y: clientY };
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopPropagation();

    isDragging.current = false;
    startPinchDist.current = 0;

    // Handle Swipe Commit (Only if Zoomed Out)
    if (transform.scale <= 1.05) {
        const SWIPE_THRESHOLD = 80;
        if (swipeOffset > SWIPE_THRESHOLD && currentIndex > 0) {
            setCurrentIndex(p => p - 1);
        } else if (swipeOffset < -SWIPE_THRESHOLD && currentIndex < images.length - 1) {
            setCurrentIndex(p => p + 1);
        }
        setSwipeOffset(0);
        setTransform({ x: 0, y: 0, scale: 1 });
    } else {
        // If zoomed out completely, reset pos
        if (transform.scale <= 1) {
            setTransform({ x: 0, y: 0, scale: 1 });
        }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) e.nativeEvent.stopPropagation();

      const scaleChange = -e.deltaY * 0.001;
      const newScale = Math.max(1, Math.min(5, transform.scale * (1 + scaleChange)));
      setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleShare = async () => {
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
              await navigator.share({ files: [file], title: '遊戲照片' });
          } else {
              const a = document.createElement('a');
              a.href = targetSrc;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              if (!navigator.canShare) showToast({ message: "已下載圖片", type: 'success' });
          }
      } catch (e: any) {
          if (e.name !== 'AbortError') {
              console.error("Share failed", e);
              showToast({ message: "分享失敗", type: 'error' });
          }
      }
  };

  const handlePrev = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (currentIndex < images.length - 1) setCurrentIndex(i => i + 1);
  };

  const currentDisplayImage = (showOverlay && composedImageUrl) ? composedImageUrl : currentImage.url;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      
      {/* Hidden Generator */}
      {showOverlay && overlayData && (
          <div style={{ position: 'absolute', top: 0, left: '-9999px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
              <ScoreOverlayGenerator 
                  ref={generatorRef}
                  imageSrc={currentImage.url}
                  data={overlayData}
              />
          </div>
      )}

      {/* Header Toolbar */}
      <div className="flex-none flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800 z-10">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 transition-colors">
            <X size={24} />
        </button>
        
        {/* Pagination Dots */}
        {images.length > 1 && (
            <div className="text-white text-sm font-bold bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                {currentIndex + 1} / {images.length}
            </div>
        )}

        <div className="flex items-center gap-3">
            {!showOverlay && (
                <button onClick={() => onDelete(currentImage.id)} className="p-2 bg-red-900/30 rounded-full text-red-400 hover:text-red-200 border border-red-500/30 transition-colors">
                    <Trash2 size={20} />
                </button>
            )}
            
            <button onClick={handleShare} disabled={isGenerating} className="p-2 bg-slate-800 rounded-full text-sky-400 hover:text-sky-200 border border-slate-700 transition-colors">
                {navigator.share ? <Share2 size={20} /> : <Download size={20} />}
            </button>
        </div>
      </div>

      {/* Main Viewer */}
      <div 
        ref={containerRef}
        className="flex-1 w-full min-h-0 overflow-hidden touch-none flex items-center justify-center bg-black relative"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        {isGenerating ? (
            <div className="flex flex-col items-center gap-3 text-emerald-500">
                <Loader2 size={48} className="animate-spin" />
                <span className="text-sm font-bold animate-pulse">正在合成計分表...</span>
            </div>
        ) : (
            <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-75 will-change-transform"
                style={{ transform: `translateX(${swipeOffset}px)` }}
            >
                <img 
                    src={currentDisplayImage} 
                    alt="Full view" 
                    className="max-w-full max-h-full object-contain select-none"
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        cursor: transform.scale > 1 ? 'grab' : 'default'
                    }}
                    draggable={false}
                />
            </div>
        )}

        {/* Navigation Arrows (Visible on Desktop or when needed) */}
        {currentIndex > 0 && transform.scale <= 1.05 && (
            <button 
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm z-20 transition-opacity opacity-50 hover:opacity-100 hidden sm:block"
            >
                <ChevronLeft size={32} />
            </button>
        )}
        {currentIndex < images.length - 1 && transform.scale <= 1.05 && (
            <button 
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm z-20 transition-opacity opacity-50 hover:opacity-100 hidden sm:block"
            >
                <ChevronRight size={32} />
            </button>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex-none p-4 bg-slate-900 border-t border-slate-800 z-10 flex items-center relative h-20">
         {/* Left: Score Toggle Button */}
         <div className="absolute left-4 top-1/2 -translate-y-1/2">
            {overlayData && (
                <button 
                    onClick={() => setShowOverlay(!showOverlay)} 
                    disabled={isGenerating}
                    className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl border transition-all active:scale-95 ${showOverlay ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ReceiptText size={20} />}
                    <span className="text-[10px] font-bold">{showOverlay ? "隱藏分數" : "顯示分數"}</span>
                </button>
            )}
         </div>

         {/* Center: Zoom Controls */}
         <div className="flex-1 flex justify-center gap-6">
            <button onClick={() => setTransform(p => ({...p, scale: Math.max(1, p.scale - 0.5)}))} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><ZoomOut size={24}/></button>
            <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><Maximize size={24}/></button>
            <button onClick={() => setTransform(p => ({...p, scale: Math.min(5, p.scale + 0.5)}))} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><ZoomIn size={24}/></button>
         </div>
      </div>
    </div>
  );
};

export default PhotoLightbox;

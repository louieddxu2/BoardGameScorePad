
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Trash2, Maximize, Share2, ReceiptText, Loader2, Download, ChevronLeft, ChevronRight, VenetianMask, Check, EyeOff } from 'lucide-react';
import { getTouchDistance, isColorDark } from '../../../utils/ui';
import { useToast } from '../../../hooks/useToast';
import { toBlob } from 'html-to-image';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';
import { LoadedImage } from '../modals/PhotoGalleryModal';

interface PhotoLightboxProps {
  images: LoadedImage[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  overlayData?: OverlayData;
  initialShowOverlay?: boolean;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ images, initialIndex, onClose, onDelete, overlayData, initialShowOverlay = false }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showOverlay, setShowOverlay] = useState(initialShowOverlay);
  const [isGenerating, setIsGenerating] = useState(false);
  const [composedImageUrl, setComposedImageUrl] = useState<string | null>(null);
  
  // Anonymous Feature State
  const [isAnonPanelOpen, setIsAnonPanelOpen] = useState(false);
  const [anonymousPlayerIds, setAnonymousPlayerIds] = useState<Set<string>>(new Set());

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
    setComposedImageUrl(null);
    setSwipeOffset(0);
    // Don't reset anonymous state per image, keep it persistent for session flow
  }, [currentIndex]);

  // Cleanup object URL
  useEffect(() => {
      return () => {
          if (composedImageUrl) URL.revokeObjectURL(composedImageUrl);
      };
  }, [composedImageUrl]);

  // Prepare Data for Generator (Masking Names)
  const displayOverlayData = useMemo(() => {
      if (!overlayData) return undefined;
      return {
          ...overlayData,
          players: overlayData.players.map((p, i) => ({
              ...p,
              // If ID is in anonymous set, replace name with Player N or trigger visual mask
              isAnonymous: anonymousPlayerIds.has(p.id),
              name: anonymousPlayerIds.has(p.id) ? `玩家 ${i + 1}` : p.name
          }))
      };
  }, [overlayData, anonymousPlayerIds]);

  // --- Generation Logic ---
  useEffect(() => {
      if (showOverlay && displayOverlayData && !isGenerating) {
          
          const generate = async () => {
              setIsGenerating(true);
              // Wait for DOM render & Image load inside generator
              await new Promise(r => setTimeout(r, 600)); 
              
              if (generatorRef.current) {
                  try {
                      const blob = await toBlob(generatorRef.current, {
                          pixelRatio: 1,
                          backgroundColor: '#0f172a',
                          skipFonts: true 
                      });
                      if (blob) {
                          const newUrl = URL.createObjectURL(blob);
                          setComposedImageUrl(prev => {
                              if (prev) URL.revokeObjectURL(prev);
                              return newUrl;
                          });
                      } else {
                          throw new Error("Blob generation returned null");
                      }
                  } catch (e) {
                      console.error("Overlay generation failed", e);
                      showToast({ message: "合成圖片失敗，請重試", type: 'error' });
                      setShowOverlay(false);
                  }
              }
              setIsGenerating(false);
          };
          generate();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOverlay, displayOverlayData]); 
  // Removed isGenerating from deps to prevent infinite loop.
  // When setIsGenerating(false) happens, it triggers re-render, but since isGenerating is not in deps, effect won't re-run.

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopPropagation();

    // Close anon panel if clicking background
    if (isAnonPanelOpen) setIsAnonPanelOpen(false);

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

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopPropagation();

    if ('touches' in e && e.touches.length === 2) {
        const dist = getTouchDistance(e.touches);
        if (startPinchDist.current > 0) {
            const scaleFactor = dist / startPinchDist.current;
            const newScale = Math.max(1, Math.min(5, startPinchScale.current * scaleFactor));
            setTransform(prev => ({ ...prev, scale: newScale }));
        }
        return;
    } 
    
    if (isDragging.current) {
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        
        const dx = clientX - lastPos.current.x;
        const dy = clientY - lastPos.current.y;
        
        if (transform.scale > 1.05) {
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        } else {
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      
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
      <div className="flex-none flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800 z-10 h-16">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 transition-colors">
            <X size={24} />
        </button>
        
        {images.length > 1 && (
            <div className="text-white text-sm font-bold bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                {currentIndex + 1} / {images.length}
            </div>
        )}

        <div className="flex items-center gap-2">
            <button onClick={() => onDelete(currentImage.id)} className="p-2 bg-slate-800 rounded-full text-red-400 hover:text-red-200 border border-slate-700 transition-colors active:scale-95">
                <Trash2 size={24} />
            </button>
            <button onClick={handleShare} disabled={isGenerating} className="p-2 bg-slate-800 rounded-full text-sky-400 hover:text-sky-200 border border-slate-700 transition-colors active:scale-95">
                {navigator.share ? <Share2 size={24} /> : <Download size={24} />}
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
            <div className="flex flex-col items-center gap-3 text-emerald-500 z-20">
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

        {/* Navigation Arrows */}
        {currentIndex > 0 && transform.scale <= 1.05 && (
            <button onClick={handlePrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 hidden sm:block">
                <ChevronLeft size={32} />
            </button>
        )}
        {currentIndex < images.length - 1 && transform.scale <= 1.05 && (
            <button onClick={handleNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 hidden sm:block">
                <ChevronRight size={32} />
            </button>
        )}
      </div>

      {/* Anonymous Settings Panel (Floating) */}
      {isAnonPanelOpen && overlayData && (
          <div className="absolute bottom-24 left-4 right-4 bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 z-30 shadow-2xl animate-in slide-in-from-bottom-5">
              <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase">點擊以隱藏玩家姓名</span>
                  <button onClick={() => setIsAnonPanelOpen(false)} className="p-1 bg-slate-700 rounded-full text-slate-300"><X size={14} /></button>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {overlayData.players.map((p, i) => {
                      const isHidden = anonymousPlayerIds.has(p.id);
                      const playerColor = p.color === 'transparent' ? '#94a3b8' : p.color;
                      const isDark = isColorDark(playerColor);

                      return (
                          <button
                              key={p.id}
                              onClick={() => toggleAnonymous(p.id)}
                              className={`
                                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0 min-w-[100px]
                                  ${isHidden 
                                      ? 'bg-slate-900 border-slate-700 text-slate-500 opacity-70' 
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
      <div className="flex-none px-4 py-3 bg-slate-900 border-t border-slate-800 z-20 flex items-center justify-between h-20 gap-4">
         
         {/* Left Group: Config & Show */}
         <div className="flex items-center gap-2">
            {overlayData && (
                <>
                    <button 
                        onClick={() => setIsAnonPanelOpen(!isAnonPanelOpen)}
                        disabled={isGenerating}
                        className={`p-3 rounded-xl border transition-all active:scale-95 ${isAnonPanelOpen ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        title="匿名設定"
                    >
                        <VenetianMask size={20} />
                    </button>

                    <button 
                        onClick={handleToggleOverlay}
                        disabled={isGenerating}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all active:scale-95 font-bold text-sm min-w-[110px] justify-center
                            ${showOverlay 
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50' 
                                : 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                            }`}
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ReceiptText size={18} />}
                        <span>{showOverlay ? "隱藏分數" : "顯示分數"}</span>
                    </button>
                </>
            )}
         </div>

         {/* Center: Reset View */}
         <div className="flex-1 flex justify-center">
             <button 
                onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} 
                className="p-3 rounded-full bg-slate-800 text-slate-400 border border-slate-700 active:scale-95 hover:text-white"
                title="重置視角"
             >
                <Maximize size={20}/>
             </button>
         </div>

         {/* Right Group: Empty Spacer (Buttons moved to Header) */}
         <div className="w-[80px]"></div>
      </div>
    </div>
  );
};

export default PhotoLightbox;


import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, ZoomIn, ZoomOut, Maximize, Share2 } from 'lucide-react';
import { getTouchDistance } from '../../../utils/ui';
import { useToast } from '../../../hooks/useToast';

interface PhotoLightboxProps {
  imageSrc: string;
  onClose: () => void;
  onDelete: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ imageSrc, onClose, onDelete }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPinchDist = useRef(0);
  const startPinchScale = useRef(1);

  // Reset transform when image changes
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [imageSrc]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
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

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current && !('touches' in e && e.touches.length === 2)) return;
    e.preventDefault();

    if ('touches' in e && e.touches.length === 2) {
        // Pinch Zoom
        const dist = getTouchDistance(e.touches);
        if (startPinchDist.current > 0) {
            const scaleFactor = dist / startPinchDist.current;
            const newScale = Math.max(1, Math.min(5, startPinchScale.current * scaleFactor));
            setTransform(prev => ({ ...prev, scale: newScale }));
        }
    } else if (isDragging.current) {
        // Pan
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        
        const dx = clientX - lastPos.current.x;
        const dy = clientY - lastPos.current.y;
        
        // Allow panning only when zoomed in or logically consistent
        setTransform(prev => {
            // Simple bound calculation could be added here, but free pan is often acceptable for lightboxes
            return { ...prev, x: prev.x + dx, y: prev.y + dy };
        });
        
        lastPos.current = { x: clientX, y: clientY };
    }
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    startPinchDist.current = 0;
    
    // Snap back if scale is 1
    if (transform.scale <= 1) {
        setTransform({ x: 0, y: 0, scale: 1 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      const scaleChange = -e.deltaY * 0.001;
      const newScale = Math.max(1, Math.min(5, transform.scale * (1 + scaleChange)));
      setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleShare = async () => {
      try {
          // Fetch the blob from the object URL
          const response = await fetch(imageSrc);
          const blob = await response.blob();
          
          // Dynamic extension based on MIME type
          // iOS Safari is sensitive to file extensions matching the MIME type
          const mimeType = blob.type;
          let extension = 'jpg';
          if (mimeType === 'image/png') extension = 'png';
          else if (mimeType === 'image/webp') extension = 'webp';
          
          const fileName = `photo_${Date.now()}.${extension}`;
          const file = new File([blob], fileName, { type: mimeType });
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: '遊戲照片'
              });
          } else {
              // Fallback for browsers that don't support file sharing or restricted context
              // Try standard download/open
              const a = document.createElement('a');
              a.href = imageSrc;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              if (!navigator.canShare) {
                  showToast({ message: "您的瀏覽器不支援分享，已改為下載", type: 'info' });
              }
          }
      } catch (e: any) {
          // AbortError usually means the user cancelled the share sheet
          if (e.name !== 'AbortError') {
              console.error("Share failed", e);
              showToast({ message: "分享失敗", type: 'error' });
          }
      }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      {/* Header Toolbar (Flex-none to take up space) */}
      <div className="flex-none flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800 z-10">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700 transition-colors">
            <X size={24} />
        </button>
        <div className="flex items-center gap-3">
            <button onClick={onDelete} className="p-2 bg-red-900/30 rounded-full text-red-400 hover:text-red-200 border border-red-500/30 transition-colors">
                <Trash2 size={20} />
            </button>
            <button onClick={handleShare} className="p-2 bg-slate-800 rounded-full text-sky-400 hover:text-sky-200 border border-slate-700 transition-colors">
                <Share2 size={20} />
            </button>
        </div>
      </div>

      {/* Main Viewer (Flex-1 to take remaining space, relative for transform) */}
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
        <img 
            src={imageSrc} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain transition-transform duration-75 will-change-transform select-none"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                cursor: transform.scale > 1 ? 'grab' : 'default'
            }}
            draggable={false}
        />
      </div>

      {/* Footer Controls (Flex-none) */}
      <div className="flex-none p-6 bg-slate-900 border-t border-slate-800 z-10 flex justify-center gap-6">
         <button onClick={() => setTransform(p => ({...p, scale: Math.max(1, p.scale - 0.5)}))} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><ZoomOut size={24}/></button>
         <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><Maximize size={24}/></button>
         <button onClick={() => setTransform(p => ({...p, scale: Math.min(5, p.scale + 0.5)}))} className="p-3 rounded-full bg-slate-800 text-white border border-slate-700 active:scale-95"><ZoomIn size={24}/></button>
      </div>
    </div>
  );
};

export default PhotoLightbox;

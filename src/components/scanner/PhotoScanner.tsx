
import React, { useState, useRef, useEffect } from 'react';
import { X, Move } from 'lucide-react';
import { getPerspectiveTransform, warpPerspective } from '../../utils/scanUtils';
import { compressAndResizeImage } from '../../utils/imageProcessing'; 
import { GameTemplate } from '../../types';
import { usePanZoom } from '../../hooks/usePanZoom';
import { useScannerInteractions } from './hooks/useScannerInteractions';
import CameraView from './CameraView';
import Magnifier from './Magnifier';
import ScanPreview from './ScanPreview';
import ScannerSourceSelector from './ScannerSourceSelector';
import ScannerOverlay from './ScannerOverlay';
import ScannerControls from './ScannerControls';

interface Point {
  x: number;
  y: number;
}

interface PhotoScannerProps {
  onClose: () => void;
  onConfirm: (result: { processed: string; raw: string; points: Point[]; blob?: Blob; aspectRatio: number; intent?: 'save' | 'edit_grid' }) => void;
  initialImage?: string | null;
  initialPoints?: Point[];
  fixedAspectRatio?: number; 
  template?: GameTemplate; 
}

const PhotoScanner: React.FC<PhotoScannerProps> = ({ onClose, onConfirm, initialImage, initialPoints, fixedAspectRatio, template }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [isSnapping, setIsSnapping] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showCamera, setShowCamera] = useState(false); 
  
  // Results
  const [rectifiedImage, setRectifiedImage] = useState<string | null>(null);
  const [rectifiedBlob, setRectifiedBlob] = useState<Blob | null>(null);
  const [resultAspectRatio, setResultAspectRatio] = useState<number>(1);
  
  const [sourceDimensions, setSourceDimensions] = useState<{w: number, h: number} | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { transform, panZoomHandlers, fitToScreen } = usePanZoom({ containerRef });
  const hasFittedRef = useRef(false);

  const {
      points,
      setPoints,
      activePointIdx,
      snapType,
      activeAngles,
      geometricGhost,
      magnifierPos,
      handlePointStart
  } = useScannerInteractions({
      canvasRef,
      containerRef,
      transform,
      isSnapping,
      imageSrc
  });

  // Clean up blob URLs
  useEffect(() => {
      return () => {
          if (rectifiedImage && rectifiedImage.startsWith('blob:')) {
              URL.revokeObjectURL(rectifiedImage);
          }
      };
  }, [rectifiedImage]);

  // --- Image Loading ---

  const handleCapture = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setPoints([]);
      hasFittedRef.current = false;
      setSourceDimensions(null);
      setShowCamera(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setPoints([]);
      hasFittedRef.current = false;
      setSourceDimensions(null);
    }
    e.target.value = ''; 
  };

  useEffect(() => {
      if (!containerRef.current || !imageSrc) return;
      const resizeObserver = new ResizeObserver(() => {
          if (transform.scale < 0.01) {
              if (canvasRef.current) {
                  fitToScreen(canvasRef.current.width, canvasRef.current.height);
                  hasFittedRef.current = true;
              }
          }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
  }, [imageSrc, fitToScreen, transform.scale]);

  useEffect(() => {
    if (imageSrc && canvasRef.current && !showPreview) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const maxDim = 1920; 
        let w = img.width;
        let h = img.height;
        
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.floor(w * ratio);
          h = Math.floor(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        setSourceDimensions({ w, h });
        
        ctx?.drawImage(img, 0, 0, w, h);

        // [Fix] Point Initialization Logic
        // Check if we need to initialize points (if empty)
        if (points.length === 0) {
            // Priority: Use restored points (initialPoints) if available
            if (initialPoints && initialPoints.length === 4) {
                setPoints(initialPoints);
            } else {
                // Fallback: Default Corners
                setPoints([
                    { x: 0, y: 0 },
                    { x: w, y: 0 },
                    { x: w, y: h },
                    { x: 0, y: h }
                ]);
            }
        }
        
        if (!hasFittedRef.current) {
            fitToScreen(w, h);
            hasFittedRef.current = true;
        }
      };
      img.src = imageSrc;
    }
  }, [imageSrc, showPreview, fitToScreen, points.length, setPoints, initialPoints]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      // Delegate pan/zoom to the hook, but point start is handled by Overlay
      if ('touches' in e) {
          panZoomHandlers.onTouchStart(e as React.TouchEvent);
      } else {
          panZoomHandlers.onMouseDown(e as React.MouseEvent);
      }
  };

  const handleRotate = () => {
      if (!canvasRef.current || !imageSrc) return;
      const img = new Image();
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(90 * Math.PI / 180);
              ctx.drawImage(img, -img.width / 2, -img.height / 2);
              
              canvas.toBlob((blob) => {
                  if (blob) {
                      const url = URL.createObjectURL(blob);
                      setImageSrc(url);
                      // Reset points for new orientation
                      setPoints([
                          { x: 0, y: 0 },
                          { x: canvas.width, y: 0 },
                          { x: canvas.width, y: canvas.height },
                          { x: 0, y: canvas.height }
                      ]);
                      hasFittedRef.current = false;
                  }
              }, 'image/jpeg');
          }
      };
      img.src = imageSrc;
  };

  const dist = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  const handleRectify = async () => {
    if (!canvasRef.current || points.length !== 4) return;
    const srcCanvas = canvasRef.current;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;

    const [tl, tr, br, bl] = points;
    const widthTop = dist(tl, tr);
    const widthBottom = dist(bl, br);
    const heightLeft = dist(tl, bl);
    const heightRight = dist(tr, br);
    const maxWidth = Math.max(widthTop, widthBottom);
    const maxHeight = Math.max(heightLeft, heightRight);
    
    const maxResolution = 1920;
    const scale = Math.min(1, maxResolution / Math.max(maxWidth, maxHeight));
    
    let finalWidth = Math.floor(maxWidth * scale);
    let finalHeight = Math.floor(maxHeight * scale);

    if (fixedAspectRatio) {
        finalHeight = Math.floor(finalWidth / fixedAspectRatio);
    }

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = finalWidth;
    dstCanvas.height = finalHeight;
    const dstCtx = dstCanvas.getContext('2d');
    if (!dstCtx) return;

    const dstPoints = [{ x: 0, y: 0 }, { x: finalWidth, y: 0 }, { x: finalWidth, y: finalHeight }, { x: 0, y: finalHeight }];
    const h = getPerspectiveTransform(dstPoints, points);
    
    warpPerspective(srcCtx, dstCtx, srcCanvas.width, srcCanvas.height, finalWidth, finalHeight, h);
    
    const highResBase64 = dstCanvas.toDataURL('image/jpeg', 0.95);
    const optimizedBlob = await compressAndResizeImage(highResBase64, 1, 1920);
    const optimizedUrl = URL.createObjectURL(optimizedBlob);
    
    setRectifiedBlob(optimizedBlob);
    setRectifiedImage(optimizedUrl);
    setResultAspectRatio(finalWidth / finalHeight);
    setShowPreview(true);
  };

  const handleConfirm = (intent: 'save' | 'edit_grid') => {
      if (rectifiedImage && imageSrc) {
          onConfirm({ 
              processed: rectifiedImage, 
              raw: imageSrc, 
              points: points,
              blob: rectifiedBlob || undefined,
              aspectRatio: resultAspectRatio,
              intent
          });
      }
      onClose();
  };

  if (showPreview && rectifiedImage) {
    return (
        <ScanPreview 
            imageSrc={rectifiedImage} 
            template={template} 
            onBack={() => setShowPreview(false)} 
            onConfirm={handleConfirm}
        />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-50">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button>
        <h2 className="text-white font-bold">矩形校正</h2>
        <div className="w-10"></div>
      </div>

      <div 
           className="flex-1 relative overflow-hidden bg-black/50 touch-none select-none" 
           ref={containerRef}
           onMouseDown={handlePointerDown}
           onTouchStart={handlePointerDown}
           onWheel={panZoomHandlers.onWheel}
      >
        {showCamera && (
            <CameraView 
                onCapture={handleCapture}
                onClose={() => setShowCamera(false)}
            />
        )}

        {!imageSrc ? (
          <ScannerSourceSelector 
            onCameraSelect={() => setShowCamera(true)}
            onFileSelect={handleFileSelect}
          />
        ) : (
          <div 
            ref={contentRef}
            className="absolute top-0 left-0 origin-top-left will-change-transform"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                width: sourceDimensions?.w || canvasRef.current?.width,
                height: sourceDimensions?.h || canvasRef.current?.height,
            }}
          >
            <canvas ref={canvasRef} className="hidden" />
            <img src={imageSrc} className="block w-full h-full object-contain pointer-events-none select-none" alt="Scan Target" draggable={false} />
            
            {!showPreview && points.length === 4 && (
                <ScannerOverlay 
                    points={points}
                    activePointIdx={activePointIdx}
                    isSnapping={isSnapping}
                    snapType={snapType}
                    activeAngles={activeAngles}
                    geometricGhost={geometricGhost}
                    scale={transform.scale}
                    width={canvasRef.current?.width || 100}
                    height={canvasRef.current?.height || 100}
                    onPointStart={handlePointStart}
                />
            )}
          </div>
        )}
      </div>

      {imageSrc && !showCamera && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur text-white text-xs rounded-full pointer-events-none flex items-center gap-2 z-40 opacity-70 whitespace-nowrap">
              <Move size={12} /> 拖曳4個點到計分紙角落
          </div>
      )}

      {magnifierPos && activePointIdx !== null && canvasRef.current && points[activePointIdx] && (
          <Magnifier 
              sourceCanvas={canvasRef.current}
              imageX={points[activePointIdx].x}
              imageY={points[activePointIdx].y}
              screenX={magnifierPos.left}
              screenY={magnifierPos.top}
              isLineSnapped={snapType === 'line'}
          />
      )}

      {imageSrc && !showCamera && (
        <ScannerControls 
            isSnapping={isSnapping}
            onToggleSnap={() => setIsSnapping(!isSnapping)}
            onCenter={() => { if(canvasRef.current) fitToScreen(canvasRef.current.width, canvasRef.current.height); hasFittedRef.current = true; }}
            onRetake={() => setShowCamera(true)}
            onRotate={handleRotate}
            onConfirm={handleRectify}
            canConfirm={!!imageSrc && points.length === 4}
        />
      )}
    </div>
  );
};

export default PhotoScanner;

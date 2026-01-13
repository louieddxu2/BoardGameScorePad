
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Magnet, RotateCcw, BoxSelect, ScanLine, ZoomIn, Move, Download, Share2, ArrowRight, Check, RotateCw, Aperture, SwitchCamera, Focus } from 'lucide-react';
import { getPerspectiveTransform, findStrongestCorner, warpPerspective, calculateParallelogramPoint, getEdgeAngles, snapToEdge } from '../../utils/scanUtils';
import { getTouchDistance } from '../../utils/ui';
import { useToast } from '../../hooks/useToast';
import { compressAndResizeImage } from '../../utils/imageProcessing'; 

interface Point {
  x: number;
  y: number;
}

interface PhotoScannerProps {
  onClose: () => void;
  // Updated signature to include aspectRatio
  onConfirm: (result: { processed: string; raw: string; points: Point[]; blob?: Blob; aspectRatio: number }) => void;
  initialImage?: string | null;
  initialPoints?: Point[];
  fixedAspectRatio?: number; // [New] Force output ratio (width / height)
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

const PhotoScanner: React.FC<PhotoScannerProps> = ({ onClose, onConfirm, initialImage, initialPoints, fixedAspectRatio }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [points, setPoints] = useState<Point[]>(initialPoints || []); 
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);
  const [isSnapping, setIsSnapping] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  
  // This holds the Preview URL (blob:...)
  const [rectifiedImage, setRectifiedImage] = useState<string | null>(null);
  // This holds the actual Blob data to save
  const [rectifiedBlob, setRectifiedBlob] = useState<Blob | null>(null);
  // This holds the calculated or enforced aspect ratio
  const [resultAspectRatio, setResultAspectRatio] = useState<number>(1);

  const [geometricGhost, setGeometricGhost] = useState<Point | null>(null);
  
  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // Dimensions state
  const [sourceDimensions, setSourceDimensions] = useState<{w: number, h: number} | null>(null);

  // Snapping Feedback
  const [snapType, setSnapType] = useState<'none' | 'corner' | 'line'>('none');
  const [activeAngles, setActiveAngles] = useState<number[]>([]);
  const [magnifierPos, setMagnifierPos] = useState<{top: number, left: number} | null>(null);

  // Velocity Tracking
  const lastMoveTime = useRef<number>(0);
  const lastMovePos = useRef<{x: number, y: number} | null>(null);

  // Pan & Zoom
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const hasFittedRef = useRef(false);
  
  // Refs
  const stateRef = useRef({ activePointIdx, points, isSnapping, transform, imageSrc });
  const isDraggingView = useRef(false);
  const lastPanPoint = useRef<{x: number, y: number} | null>(null);
  const startPinchDist = useRef<number>(0);
  const startPinchScale = useRef<number>(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { showToast } = useToast();

  useEffect(() => {
      stateRef.current = { activePointIdx, points, isSnapping, transform, imageSrc };
  }, [activePointIdx, points, isSnapping, transform, imageSrc]);

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
      return () => {
          if (rectifiedImage && rectifiedImage.startsWith('blob:')) {
              URL.revokeObjectURL(rectifiedImage);
          }
      };
  }, [rectifiedImage]);

  // --- Camera Logic ---

  const stopCamera = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
              track.stop();
          });
          streamRef.current = null;
      }
      if (videoRef.current) {
          videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
  };

  useEffect(() => {
      return () => {
          stopCamera();
      };
  }, []);

  const startCamera = async () => {
      stopCamera();
      try {
          const stream = await navigator.mediaDevices.getUserMedia({
              video: { 
                  facingMode: facingMode,
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
              },
              audio: false
          });
          streamRef.current = stream;
          setIsCameraActive(true);
      } catch (err: any) {
          const errMsg = err.message || '';
          const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || errMsg.includes('Permission dismissed');
          
          if (isPermission) {
              console.warn("Camera Permission:", err);
              showToast({ message: "相機存取被拒或取消。", type: 'info' });
          } else if (err.name === 'NotFoundError') {
              console.warn("Camera Not Found:", err);
              showToast({ message: "找不到相機裝置。", type: 'warning' });
          } else {
              console.error("Camera Error:", err);
              showToast({ message: "無法啟動相機，請嘗試使用上傳功能。", type: 'error' });
          }
          setIsCameraActive(false);
      }
  };

  useEffect(() => {
      if (isCameraActive && videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(e => console.error("Video play failed", e));
      }
  }, [isCameraActive]);

  const switchCamera = () => {
      stopCamera();
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
      setTimeout(() => startCamera(), 100);
  };

  const capturePhoto = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
          if (facingMode === 'user') {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          setImageSrc(dataUrl);
          
          stopCamera();
          setPoints([]);
          hasFittedRef.current = false;
          setSourceDimensions(null);
      }
  };

  // --- Image Handling Logic ---

  const fitImageToScreen = () => {
      if (!canvasRef.current || !containerRef.current) return;
      
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      const rect = containerRef.current.getBoundingClientRect();
      
      if (rect.width <= 0 || rect.height <= 0 || w === 0 || h === 0) return;

      const scale = Math.min(rect.width / w, rect.height / h) * 0.9;
      const tx = (rect.width - w * scale) / 2;
      const ty = (rect.height - h * scale) / 2;
      
      setTransform({ x: tx, y: ty, scale });
      hasFittedRef.current = true;
  };

  useEffect(() => {
      if (!containerRef.current || !imageSrc) return;
      const resizeObserver = new ResizeObserver(() => {
          if (stateRef.current.transform.scale < 0.01) {
              fitImageToScreen();
          }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
  }, [imageSrc]);

  useEffect(() => {
    if (imageSrc && canvasRef.current && !showPreview) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // [Optimized] Use 1920 for editor working canvas as well
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

        if (stateRef.current.points.length === 0) {
            setPoints([
                { x: 0, y: 0 },
                { x: w, y: 0 },
                { x: w, y: h },
                { x: 0, y: h }
            ]);
        }
        
        if (!hasFittedRef.current) {
            fitImageToScreen();
        }
      };
      img.src = imageSrc;
    }
  }, [imageSrc, showPreview]);

  const updateMagnifier = (x: number, y: number, isLineSnapped: boolean) => {
      const srcCanvas = canvasRef.current;
      const magCanvas = magnifierCanvasRef.current;
      if (!srcCanvas || !magCanvas) return;

      const magCtx = magCanvas.getContext('2d');
      if (!magCtx) return;

      const zoom = 2; 
      const size = 120;

      magCtx.clearRect(0, 0, size, size);
      magCtx.fillStyle = '#000';
      magCtx.fillRect(0, 0, size, size);

      magCtx.save();
      magCtx.translate(size / 2, size / 2);
      magCtx.scale(zoom, zoom);
      magCtx.translate(-x, -y);
      magCtx.drawImage(srcCanvas, 0, 0);
      magCtx.restore();

      magCtx.strokeStyle = isLineSnapped ? '#facc15' : '#06b6d4'; 
      magCtx.lineWidth = isLineSnapped ? 2 : 1;
      
      magCtx.beginPath();
      magCtx.moveTo(size / 2, 0);
      magCtx.lineTo(size / 2, size);
      magCtx.moveTo(0, size / 2);
      magCtx.lineTo(size, size / 2);
      magCtx.stroke();
      
      magCtx.strokeStyle = '#fff';
      magCtx.lineWidth = 4;
      magCtx.strokeRect(0, 0, size, size);
  };

  const screenToImage = (clientX: number, clientY: number) => {
      const { transform } = stateRef.current;
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const imgX = (relX - transform.x) / transform.scale;
      const imgY = (relY - transform.y) / transform.scale;
      return { x: imgX, y: imgY };
  };

  const handlePointDrag = (clientX: number, clientY: number) => {
        if (!canvasRef.current) return;
        const { isSnapping, activePointIdx, points, transform } = stateRef.current;
        const { x, y } = screenToImage(clientX, clientY);

        const now = Date.now();
        const dt = now - lastMoveTime.current;
        let speed = 100; 
        if (lastMovePos.current && dt > 0) {
            const dist = Math.sqrt(Math.pow(x - lastMovePos.current.x, 2) + Math.pow(y - lastMovePos.current.y, 2));
            speed = dist / dt;
        }
        lastMoveTime.current = now;
        lastMovePos.current = { x, y };

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const clampedX = Math.max(0, Math.min(x, width));
        const clampedY = Math.max(0, Math.min(y, height));

        let snappedX = clampedX;
        let snappedY = clampedY;
        let currentSnapType: 'none' | 'corner' | 'line' = 'none';
        
        const ctx = canvasRef.current.getContext('2d');

        // Dynamic Snap Radius Logic
        const currentScale = transform.scale;
        const dynamicRadius = Math.max(5, Math.min(30, 25 / currentScale));
        const geoSnapThreshold = Math.max(10, Math.min(50, 40 / currentScale));

        if (isSnapping && ctx && activePointIdx !== null) {
            const geoPoint = calculateParallelogramPoint(points, activePointIdx);
            setGeometricGhost(geoPoint);

            let geoSnapped = false;
            if (geoPoint) {
                const dist = Math.sqrt(Math.pow(clampedX - geoPoint.x, 2) + Math.pow(clampedY - geoPoint.y, 2));
                if (dist < geoSnapThreshold) { 
                    snappedX = geoPoint.x;
                    snappedY = geoPoint.y;
                    geoSnapped = true;
                    currentSnapType = 'corner';
                }
            }

            if (!geoSnapped) {
                // Use dynamic radius for detection
                const cornerResult = findStrongestCorner(ctx, clampedX, clampedY, dynamicRadius); 
                if (cornerResult) {
                    snappedX = cornerResult.x;
                    snappedY = cornerResult.y;
                    currentSnapType = 'corner';
                } else if (speed < 0.8) { 
                    const lineSnapResult = snapToEdge(ctx, clampedX, clampedY, dynamicRadius);
                    if (lineSnapResult) {
                        snappedX = lineSnapResult.x;
                        snappedY = lineSnapResult.y;
                        currentSnapType = 'line';
                    }
                }
            }
        } else {
            setGeometricGhost(null);
        }

        if (ctx) {
            const currentAngles = getEdgeAngles(ctx, snappedX, snappedY, dynamicRadius); 
            setActiveAngles(currentAngles);
        }

        setSnapType(currentSnapType);
        setPoints(prev => prev.map((p, i) => i === activePointIdx ? { x: snappedX, y: snappedY } : p));
        
        const magOffset = 100;
        let magTop = clientY - magOffset;
        if (magTop < 50) magTop = clientY + magOffset; 
        setMagnifierPos({ top: magTop, left: clientX });
        updateMagnifier(snappedX, snappedY, currentSnapType === 'line');
  };

  const handlePanZoom = (clientX: number, clientY: number) => {
      if (lastPanPoint.current) {
          const dx = clientX - lastPanPoint.current.x;
          const dy = clientY - lastPanPoint.current.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          lastPanPoint.current = { x: clientX, y: clientY };
      }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
        const { activePointIdx } = stateRef.current;
        if (activePointIdx !== null) {
            e.preventDefault();
            handlePointDrag(e.clientX, e.clientY);
        } else if (isDraggingView.current) {
            e.preventDefault();
            handlePanZoom(e.clientX, e.clientY);
        }
    };
    
    const onTouchMove = (e: TouchEvent) => {
        const { activePointIdx, transform } = stateRef.current;
        if (activePointIdx !== null || isDraggingView.current || e.touches.length === 2) {
            e.preventDefault();
        }

        if (activePointIdx !== null) {
            handlePointDrag(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
            const dist = getTouchDistance(e.touches);
            if (startPinchDist.current > 0) {
                const scaleFactor = dist / startPinchDist.current;
                const newScale = Math.max(0.1, Math.min(10, startPinchScale.current * scaleFactor));
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const cx = rect.width / 2;
                    const cy = rect.height / 2;
                    const imgCx = (cx - transform.x) / transform.scale;
                    const imgCy = (cy - transform.y) / transform.scale;
                    const newTx = cx - (imgCx * newScale);
                    const newTy = cy - (imgCy * newScale);
                    setTransform({ x: newTx, y: newTy, scale: newScale });
                }
            }
        } else if (isDraggingView.current && e.touches.length === 1) {
            handlePanZoom(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const onEnd = () => {
        setActivePointIdx(null);
        isDraggingView.current = false;
        lastPanPoint.current = null;
        startPinchDist.current = 0;
        setGeometricGhost(null);
        setMagnifierPos(null);
        setActiveAngles([]);
        setSnapType('none');
        lastMovePos.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, pointIdx: number | null) => {
      e.stopPropagation(); 
      if (pointIdx !== null) {
          setActivePointIdx(pointIdx);
          lastMoveTime.current = Date.now();
          lastMovePos.current = null;
      } else {
          const isTouch = 'touches' in e;
          if (isTouch && (e as React.TouchEvent).touches.length === 2) {
              startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
              startPinchScale.current = stateRef.current.transform.scale;
              isDraggingView.current = false;
          } else {
              isDraggingView.current = true;
              const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
              const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
              lastPanPoint.current = { x: clientX, y: clientY };
          }
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      const { transform } = stateRef.current;
      const scaleChange = -e.deltaY * 0.001;
      const newScale = Math.max(0.1, Math.min(10, transform.scale * (1 + scaleChange)));
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const imgX = (mouseX - transform.x) / transform.scale;
          const imgY = (mouseY - transform.y) / transform.scale;
          const newTx = mouseX - (imgX * newScale);
          const newTy = mouseY - (imgY * newScale);
          setTransform({ x: newTx, y: newTy, scale: newScale });
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
          setImageSrc(ev.target?.result as string);
          setPoints([]);
          hasFittedRef.current = false;
          setSourceDimensions(null);
      };
      reader.readAsDataURL(file);
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
              setImageSrc(canvas.toDataURL());
              setPoints([
                  { x: 0, y: 0 },
                  { x: canvas.width, y: 0 },
                  { x: canvas.width, y: canvas.height },
                  { x: 0, y: canvas.height }
              ]);
              hasFittedRef.current = false;
          }
      };
      img.src = imageSrc;
  };

  const dist = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  const polygonPoints = points.length === 4 && canvasRef.current ? `${points[0].x},${points[0].y} ${points[1].x},${points[1].y} ${points[2].x},${points[2].y} ${points[3].x},${points[3].y}` : "";

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
    
    // [Resolution Bump] 1500 -> 1920 (1080p width)
    const maxResolution = 1920;
    const scale = Math.min(1, maxResolution / Math.max(maxWidth, maxHeight));
    
    let finalWidth = Math.floor(maxWidth * scale);
    let finalHeight = Math.floor(maxHeight * scale);

    // [New] Enforce Locked Aspect Ratio if provided
    if (fixedAspectRatio) {
        // We trust the width from the photo but enforce the height to match the ratio
        finalHeight = Math.floor(finalWidth / fixedAspectRatio);
    }

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = finalWidth;
    dstCanvas.height = finalHeight;
    const dstCtx = dstCanvas.getContext('2d');
    if (!dstCtx) return;

    const dstPoints = [{ x: 0, y: 0 }, { x: finalWidth, y: 0 }, { x: finalWidth, y: finalHeight }, { x: 0, y: finalHeight }];
    const h = getPerspectiveTransform(dstPoints, points);
    
    // Warp logic remains the same (High Res)
    warpPerspective(srcCtx, dstCtx, srcCanvas.width, srcCanvas.height, finalWidth, finalHeight, h);
    
    // [Compression] Get the base64 from the High-Res canvas
    const highResBase64 = dstCanvas.toDataURL('image/jpeg', 0.95);
    
    // [Compression] Optimized one-shot compression to Blob
    const optimizedBlob = await compressAndResizeImage(highResBase64, 1, 1920);
    
    // Convert Blob to URL for preview
    const optimizedUrl = URL.createObjectURL(optimizedBlob);
    
    setRectifiedBlob(optimizedBlob);
    setRectifiedImage(optimizedUrl);
    setResultAspectRatio(finalWidth / finalHeight); // Save ratio for template
    setShowPreview(true);
  };

  const handleSaveToDevice = async () => {
    if (!rectifiedImage) return;
    try {
        const response = await fetch(rectifiedImage);
        const blob = await response.blob();
        const file = new File([blob], `score-sheet-${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: '已校正計分表' });
        } else {
            const link = document.createElement('a');
            link.href = rectifiedImage;
            link.download = `score-sheet-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e: any) {
        if (e.name !== 'AbortError') console.error("Save/Share failed", e);
    }
  };

  const handleConfirm = () => {
      stopCamera();
      if (rectifiedImage && imageSrc) {
          onConfirm({ 
              processed: rectifiedImage, 
              raw: imageSrc, 
              points: points,
              blob: rectifiedBlob || undefined,
              aspectRatio: resultAspectRatio // Return the ratio
          });
      }
      onClose();
  };

  const handleClose = () => {
      stopCamera();
      onClose();
  };

  if (showPreview) {
    return (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
            <header className="flex-none p-4 bg-slate-900 border-b border-slate-800 flex justify-center items-center">
                <h2 className="text-white font-bold">預覽與確認</h2>
            </header>
            <main className="flex-1 w-full h-full flex items-center justify-center overflow-hidden p-4 bg-black/50">
               {rectifiedImage ? (
                   <img src={rectifiedImage} className="max-w-full max-h-full object-contain mx-auto shadow-2xl" alt="校正結果" />
               ) : (
                   <div className="text-white">處理中...</div>
               )}
            </main>
            <footer className="flex-none w-full p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
               <button onClick={() => setShowPreview(false)} className="px-6 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-bold">返回調整</button>
               <div className="flex items-center gap-3">
                    <button onClick={handleSaveToDevice} className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-lg flex items-center gap-2">
                        {navigator.share ? <Share2 size={18} /> : <Download size={18} />}
                        <span className="hidden sm:inline">儲存圖片</span>
                    </button>
                    <button onClick={handleConfirm} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg flex items-center gap-2"><Check size={24} /></button>
               </div>
            </footer>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-50">
        <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button>
        <h2 className="text-white font-bold">矩形校正</h2>
        <div className="w-10"></div>
      </div>

      <div 
           className="flex-1 relative overflow-hidden bg-black/50 touch-none select-none" 
           ref={containerRef}
           onMouseDown={(e) => handlePointerDown(e, null)}
           onTouchStart={(e) => handlePointerDown(e, null)}
           onWheel={handleWheel}
      >
        {isCameraActive ? (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-[60]">
                <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover" 
                    playsInline 
                    autoPlay 
                    muted 
                />
                <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-12 bg-gradient-to-t from-black/80 to-transparent">
                    <button onClick={switchCamera} className="p-4 bg-slate-800/50 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-95 transition-transform"><SwitchCamera size={24} /></button>
                    <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:scale-95 transition-transform"><div className="w-16 h-16 bg-white rounded-full"></div></button>
                    <button onClick={stopCamera} className="p-4 bg-slate-800/50 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-95 transition-transform"><X size={24} /></button>
                </div>
            </div>
        ) : !imageSrc ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center space-y-6 w-full max-w-sm">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500 shadow-xl border border-slate-700"><Camera size={40} /></div>
                <h3 className="text-xl font-bold text-white">請選擇圖片來源</h3>
                <div className="flex flex-col gap-4">
                    <button onClick={startCamera} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/50 active:scale-95 transition-all">
                        <Aperture size={24} /> <span className="text-lg">拍攝照片</span>
                    </button>
                    <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-950 px-2 text-slate-500">或</span></div></div>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-3 border border-slate-600 active:scale-95 transition-all">
                        <Upload size={24} /> <span className="text-lg">從相簿上傳</span>
                    </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <p className="text-xs text-slate-500 mt-4">提示：拍攝時請盡量保持光線充足，並垂直拍攝計分表。</p>
            </div>
          </div>
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
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${canvasRef.current?.width || 100} ${canvasRef.current?.height || 100}`} style={{zIndex: 10}}>
                <polygon points={polygonPoints} fill="rgba(6, 182, 212, 0.2)" stroke="#22d3ee" strokeWidth={2 / transform.scale} vectorEffect="non-scaling-stroke"/>
                {activePointIdx !== null && activeAngles.length > 0 && activeAngles.map((angle, idx) => {
                    const p = points[activePointIdx];
                    const rad = angle * Math.PI / 180;
                    const dx = Math.cos(rad) * 10000; const dy = Math.sin(rad) * 10000;
                    return <line key={`guide-${idx}`} x1={p.x - dx} y1={p.y - dy} x2={p.x + dx} y2={p.y + dy} stroke={snapType === 'line' ? '#facc15' : '#34d399'} strokeWidth={2 / transform.scale} strokeDasharray={snapType === 'line' ? '' : '8,8'} opacity="0.8" vectorEffect="non-scaling-stroke" />;
                })}
              </svg>
            )}

            {!showPreview && geometricGhost && (
                <div className="absolute w-6 h-6 -ml-3 -mt-3 z-10 pointer-events-none flex items-center justify-center opacity-70 animate-pulse" style={{ left: geometricGhost.x, top: geometricGhost.y, transform: `scale(${1/transform.scale})` }}>
                    <div className="w-full h-full border-2 border-dashed border-sky-400 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-sky-400 rounded-full absolute"></div>
                </div>
            )}

            {!showPreview && points.map((p, i) => (
              <div key={i} onMouseDown={(e) => handlePointerDown(e, i)} onTouchStart={(e) => handlePointerDown(e, i)} className="absolute w-12 h-12 -ml-6 -mt-6 z-20 cursor-move flex items-center justify-center group" style={{ left: p.x, top: p.y, transform: `scale(${1/transform.scale})` }}>
                <div className={`w-5 h-5 rounded-full border-[3px] shadow-[0_0_2px_rgba(0,0,0,0.8)] transition-transform ${activePointIdx === i ? 'border-cyan-300 scale-125' : 'border-cyan-500'}`}></div>
                {activePointIdx === i && isSnapping && (
                   <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-white text-[10px] px-2 py-1 rounded border border-slate-700 whitespace-nowrap pointer-events-none flex items-center gap-1 shadow-lg">
                     {geometricGhost && Math.sqrt(Math.pow(p.x - geometricGhost.x, 2) + Math.pow(p.y - geometricGhost.y, 2)) < (40 / transform.scale) ? (<><BoxSelect size={10} className="text-sky-400"/> 幾何吸附</>) : snapType === 'line' ? (<><ScanLine size={10} className="text-yellow-400"/> 直線吸附</>) : (<><Magnet size={10} className="text-slate-400"/> 自由移動</>)}
                   </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {imageSrc && !isCameraActive && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur text-white text-xs rounded-full pointer-events-none flex items-center gap-2 z-40 opacity-70 whitespace-nowrap">
              <Move size={12} /> 拖曳4個點到計分紙角落
          </div>
      )}

      {magnifierPos && activePointIdx !== null && (
          <div className={`fixed z-[100] w-[120px] h-[120px] rounded-full overflow-hidden shadow-2xl border-2 pointer-events-none transition-colors ${snapType === 'line' ? 'border-yellow-400' : 'border-white'}`} style={{ top: magnifierPos.top, left: magnifierPos.left, transform: 'translate(-50%, -50%)', backgroundColor: '#000' }}>
              <canvas ref={magnifierCanvasRef} width={120} height={120} className="w-full h-full object-cover" />
          </div>
      )}

      {imageSrc && !isCameraActive && (
        <footer className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-none z-50">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSnapping(!isSnapping)} className={`flex flex-col items-center gap-1 text-xs font-bold ${isSnapping ? 'text-emerald-400' : 'text-slate-500'}`}><div className={`p-3 rounded-xl ${isSnapping ? 'bg-emerald-900/30' : 'bg-slate-800'}`}><Magnet size={20} /></div>吸附</button>
                <button onClick={() => { fitImageToScreen(); hasFittedRef.current = true; }} className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><div className="p-3 rounded-xl bg-slate-800"><Focus size={20} /></div>置中</button>
                <button onClick={() => { stopCamera(); setImageSrc(null); setPoints([]); setSourceDimensions(null); }} className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><div className="p-3 rounded-xl bg-slate-800"><Camera size={20} /></div>重拍</button>
                <button onClick={handleRotate} className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><div className="p-3 rounded-xl bg-slate-800"><RotateCw size={20} /></div>旋轉</button>
            </div>
            <button onClick={handleRectify} disabled={!imageSrc || points.length < 4} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:bg-slate-700 disabled:text-slate-500">
                <ArrowRight size={24} />
            </button>
        </footer>
      )}
    </div>
  );
};

export default PhotoScanner;

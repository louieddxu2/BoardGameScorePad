
import React, { useRef, useState, useEffect } from 'react';
import { X, SwitchCamera, Check, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface CameraViewProps {
  onCapture: (blobs: Blob[]) => void;
  onClose: () => void;
  singleShot?: boolean; // Default false (Multi-shot mode)
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose, singleShot = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [captures, setCaptures] = useState<Blob[]>([]);
  const [lastThumbnail, setLastThumbnail] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const { showToast } = useToast();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Cleanup thumbnails on unmount
  useEffect(() => {
      return () => {
          if (lastThumbnail) URL.revokeObjectURL(lastThumbnail);
      };
  }, [lastThumbnail]);

  useEffect(() => {
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        const errMsg = err.message || '';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             showToast({ message: "相機存取被拒。", type: 'warning' });
        } else if (err.name === 'NotFoundError') {
             showToast({ message: "找不到相機裝置。", type: 'warning' });
        } else {
             showToast({ message: "無法啟動相機。", type: 'error' });
        }
        onClose();
      }
    };

    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const handleShutter = () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Flash Effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    if (ctx) {
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
            if (blob) {
                if (singleShot) {
                    // Immediate return for single shot mode (Scanner)
                    onCapture([blob]);
                } else {
                    // Multi shot mode
                    setCaptures(prev => [...prev, blob]);
                    
                    // Update thumbnail
                    if (lastThumbnail) URL.revokeObjectURL(lastThumbnail);
                    setLastThumbnail(URL.createObjectURL(blob));
                }
            }
        }, 'image/jpeg', 0.95);
    }
  };

  const handleDone = () => {
      if (captures.length > 0) {
          onCapture(captures);
      } else {
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[95]">
        {/* Flash Overlay */}
        <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 z-20 ${isFlashing ? 'opacity-80' : 'opacity-0'}`} />

        <div className="relative flex-1 bg-black overflow-hidden">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
            />
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent z-10">
                <button onClick={onClose} className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform">
                    <X size={24} />
                </button>
                <button onClick={() => setFacingMode(p => p === 'environment' ? 'user' : 'environment')} className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform">
                    <SwitchCamera size={24} />
                </button>
            </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex-none h-32 bg-black flex items-center justify-between px-8 pb-4">
            
            {/* Left: Thumbnail Preview */}
            <div className="w-16 h-16 relative flex items-center justify-center">
                {lastThumbnail ? (
                    <div className="relative w-14 h-14 animate-in zoom-in duration-200">
                        {/* Image Container: Handles rounding and clipping */}
                        <div className="w-full h-full rounded-lg overflow-hidden border-2 border-white/50">
                            <img src={lastThumbnail} className="w-full h-full object-cover" alt="Last capture" />
                        </div>
                        {/* Badge: Lives outside clipping container to show fully */}
                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black z-10">
                            {captures.length}
                        </div>
                    </div>
                ) : (
                    <div className="w-12 h-12 rounded-lg border-2 border-white/20 flex items-center justify-center">
                       {/* Empty placeholder */}
                    </div>
                )}
            </div>

            {/* Center: Shutter */}
            <button 
                onClick={handleShutter} 
                className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:scale-90 transition-transform"
            >
                <div className="w-16 h-16 bg-white rounded-full"></div>
            </button>

            {/* Right: Done Button */}
            <div className="w-16 h-16 flex items-center justify-center">
                {captures.length > 0 ? (
                    <button 
                        onClick={handleDone} 
                        className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all animate-in zoom-in duration-200"
                    >
                        <Check size={28} strokeWidth={3} />
                    </button>
                ) : (
                    /* Invisible spacer to keep layout balanced */
                    <div className="w-14 h-14" />
                )}
            </div>
        </div>
    </div>
  );
};

export default CameraView;

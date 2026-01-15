
import React, { useRef, useState, useEffect } from 'react';
import { X, SwitchCamera } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface CameraViewProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const { showToast } = useToast();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

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

  const handleCapture = () => {
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
        
        // Return Blob directly (Binary) instead of Base64 string
        canvas.toBlob((blob) => {
            if (blob) onCapture(blob);
        }, 'image/jpeg', 0.95);
    }
  };

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center z-[60]">
        <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
            muted
        />
        <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-12 bg-gradient-to-t from-black/80 to-transparent">
            <button onClick={() => setFacingMode(p => p === 'environment' ? 'user' : 'environment')} className="p-4 bg-slate-800/50 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-95 transition-transform">
                <SwitchCamera size={24} />
            </button>
            <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:scale-95 transition-transform">
                <div className="w-16 h-16 bg-white rounded-full"></div>
            </button>
            <button onClick={onClose} className="p-4 bg-slate-800/50 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-95 transition-transform">
                <X size={24} />
            </button>
        </div>
    </div>
  );
};

export default CameraView;

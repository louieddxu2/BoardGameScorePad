
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, SwitchCamera, Check, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useScannerTranslation } from '../../i18n/scanner';

interface CameraViewProps {
    onCapture: (blobs: Blob[]) => void;
    onClose: () => void;
    singleShot?: boolean; // Default false (Multi-shot mode)
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose, singleShot = false }) => {
    const { t } = useScannerTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [captures, setCaptures] = useState<Blob[]>([]);
    const [lastThumbnail, setLastThumbnail] = useState<string | null>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Rotation State (Sensor): 0 (Portrait), 90 (CCW Tilt/Right Icon), -90 (CW Tilt/Left Icon)
    // This tracks the PHYSICAL orientation of the device gravity.
    const [rotation, setRotation] = useState<0 | 90 | -90>(0);

    // Layout State: Detect if browser thinks we are in landscape (width > height)
    const [isLandscapeLayout, setIsLandscapeLayout] = useState(window.innerWidth > window.innerHeight);

    const { showToast } = useToast();

    // [Logic] Effective UI Rotation
    // If the browser is ALREADY in landscape layout, the UI is natively rotated by the OS/Browser.
    // In that case, we should NOT rotate icons manually (0deg).
    // We only manually rotate icons if the browser is stuck in Portrait but the user is holding it sideways.
    const uiRotation = isLandscapeLayout ? 0 : rotation;

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

    // --- Resize Listener ---
    useEffect(() => {
        const handleResize = () => {
            setIsLandscapeLayout(window.innerWidth > window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Gravity Sensor Logic ---
    useEffect(() => {
        const handleMotion = (event: DeviceMotionEvent) => {
            const { x, y } = event.accelerationIncludingGravity || {};
            if (x === null || y === null || x === undefined || y === undefined) return;

            // Threshold to prevent jitter (approx 5 m/s^2)
            const threshold = 5;
            const portraitThreshold = 7;

            if (x > threshold) {
                setRotation(90);  // Tilted Left -> Physical Bottom is Right
            } else if (x < -threshold) {
                setRotation(-90); // Tilted Right -> Physical Bottom is Left
            } else if (Math.abs(y) > portraitThreshold) {
                setRotation(0);    // Portrait -> Physical Bottom is Bottom
            }
        };

        // Attempt to listen passively
        window.addEventListener('devicemotion', handleMotion);
        return () => window.removeEventListener('devicemotion', handleMotion);
    }, []);

    const handleManualRotate = async () => {
        // 1. If on iOS, this click can trigger permission request
        if (typeof (DeviceMotionEvent as any) !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            try {
                const permission = await (DeviceMotionEvent as any).requestPermission();
                if (permission === 'granted') {
                    showToast({ message: t('camera_toast_auto_rotate'), type: 'success' });
                    return; // Let the listener take over
                }
            } catch (e) {
                console.warn("Permission denied or error", e);
            }
        }

        // 2. Fallback: Cycle rotation manually if sensors fail or user prefers manual
        setRotation(prev => {
            if (prev === 0) return 90;
            if (prev === 90) return -90;
            return 0;
        });
    };

    useEffect(() => {
        const startCamera = async () => {
            stopCamera();
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: facingMode,
                        // Request high resolution, but let browser decide aspect ratio (usually sensor native)
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
                    showToast({ message: t('camera_toast_access_denied'), type: 'warning' });
                } else if (err.name === 'NotFoundError') {
                    showToast({ message: t('camera_toast_no_device'), type: 'warning' });
                } else {
                    showToast({ message: t('camera_toast_start_failed'), type: 'error' });
                }
                onClose();
            }
        };

        startCamera();
        return () => stopCamera();
    }, [facingMode]);

    const handleShutter = () => {
        if (!videoRef.current || !videoRef.current.videoWidth || isProcessing) return;
        const video = videoRef.current;

        // Immediate Feedback
        setIsProcessing(true);
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            setIsProcessing(false);
            return;
        }

        // Determine Output Dimensions based on Rotation
        if (Math.abs(uiRotation) === 90) {
            canvas.width = video.videoHeight;
            canvas.height = video.videoWidth;
        } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        // Transform Context for Rotation
        if (uiRotation !== 0) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((-uiRotation * Math.PI) / 180); // 修正：照片的旋轉方向應與 UI 翻轉方向相反
            ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
        } else {
            // Standard Portrait (or Native Landscape)
            ctx.drawImage(video, 0, 0);
        }

        canvas.toBlob((blob) => {
            if (blob) {
                if (singleShot) {
                    // In single shot mode, we fire and forget (parent will unmount us)
                    // Keep isProcessing true to prevent double taps during transition
                    onCapture([blob]);
                } else {
                    setCaptures(prev => [...prev, blob]);
                    if (lastThumbnail) URL.revokeObjectURL(lastThumbnail);
                    setLastThumbnail(URL.createObjectURL(blob));
                    setIsProcessing(false); // Unlock for next shot
                }
            } else {
                setIsProcessing(false); // Error -> Unlock
            }
        }, 'image/jpeg', 0.95);
    };

    const handleDone = () => {
        if (captures.length > 0) {
            onCapture(captures);
        } else {
            onClose();
        }
    };

    // Helper style for rotating UI icons (using uiRotation)
    const iconStyle = {
        transform: `rotate(${uiRotation}deg)`,
        transition: 'transform 0.3s ease-out'
    };

    let containerClass = "fixed inset-0 bg-black flex z-[10000] ";
    let controlsContainerClass = "flex-none bg-black flex items-center justify-between p-4 safe-area-bottom ";

    if (isLandscapeLayout) {
        if (rotation === -90) {
            containerClass += "flex-row-reverse";
        } else {
            containerClass += "flex-row";
        }
        controlsContainerClass += "flex-col w-32 h-full py-8";
    } else {
        containerClass += "flex-col";
        controlsContainerClass += "flex-row w-full h-32 px-8";
    }

    return createPortal(
        <div className={containerClass}>
            {/* Flash Overlay */}
            <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 z-20 ${isFlashing ? 'opacity-80' : 'opacity-0'}`} />

            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
                <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    playsInline
                    autoPlay
                    muted
                />

                {/* Top Bar (Overlay on Video) */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none">
                    <div className="pointer-events-auto">
                        <button onClick={onClose} className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform" style={iconStyle}>
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex gap-4 pointer-events-auto">
                        <button
                            onClick={handleManualRotate}
                            className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform"
                            style={iconStyle}
                        >
                            <RotateCcw size={24} />
                        </button>

                        <button onClick={() => setFacingMode(p => p === 'environment' ? 'user' : 'environment')} className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md active:scale-95 transition-transform" style={iconStyle}>
                            <SwitchCamera size={24} />
                        </button>
                    </div>
                </div>

                {/* Single Shot Hint */}
                {singleShot && (
                    <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-10">
                        <span className="text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                            {t('camera_auto_save')}
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom Controls - Adaptive Layout */}
            <div className={controlsContainerClass}>

                {/* Thumbnail Preview - HIDDEN in Single Shot */}
                <div className="w-16 h-16 relative flex items-center justify-center">
                    {!singleShot && (
                        lastThumbnail ? (
                            <div className="relative w-14 h-14 animate-in zoom-in duration-200">
                                <div className="w-full h-full rounded-lg overflow-hidden border-2 border-white/50" style={iconStyle}>
                                    <img src={lastThumbnail} className="w-full h-full object-cover" alt="Last capture" />
                                </div>
                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black z-10">
                                    {captures.length}
                                </div>
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg border-2 border-white/20 flex items-center justify-center">
                            </div>
                        )
                    )}
                </div>

                {/* Shutter */}
                <button
                    onClick={handleShutter}
                    disabled={isProcessing}
                    className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center active:scale-90 transition-transform disabled:opacity-80 disabled:scale-95"
                >
                    {isProcessing ? (
                        <Loader2 size={32} className="animate-spin text-white" />
                    ) : (
                        <div className="w-16 h-16 bg-white rounded-full transition-all" style={iconStyle}></div>
                    )}
                </button>

                {/* Done Button - HIDDEN in Single Shot */}
                <div className="w-16 h-16 flex items-center justify-center">
                    {!singleShot && captures.length > 0 ? (
                        <button
                            onClick={handleDone}
                            className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all animate-in zoom-in duration-200"
                            style={iconStyle}
                        >
                            <Check size={28} strokeWidth={3} />
                        </button>
                    ) : (
                        <div className="w-14 h-14" />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CameraView;


import React, { useRef, useLayoutEffect } from 'react';

interface MagnifierProps {
  sourceCanvas: HTMLCanvasElement | null;
  imageX: number;
  imageY: number;
  screenX: number;
  screenY: number;
  isLineSnapped: boolean;
}

const Magnifier: React.FC<MagnifierProps> = ({ 
  sourceCanvas, 
  imageX, 
  imageY, 
  screenX, 
  screenY, 
  isLineSnapped 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 120;
  const zoom = 2;

  useLayoutEffect(() => {
    const magCanvas = canvasRef.current;
    if (!magCanvas || !sourceCanvas) return;

    const ctx = magCanvas.getContext('2d');
    if (!ctx) return;

    // Clear and Fill Black
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    // Draw Source Image Cropped
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-imageX, -imageY);
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    // Draw Crosshair
    ctx.strokeStyle = isLineSnapped ? '#facc15' : '#06b6d4'; 
    ctx.lineWidth = isLineSnapped ? 2 : 1;
    
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    
    // Draw Border (Inner Stroke)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);

  }, [sourceCanvas, imageX, imageY, isLineSnapped]);

  return (
    <div 
        className={`fixed z-[100] w-[120px] h-[120px] rounded-full overflow-hidden shadow-2xl border-2 pointer-events-none transition-colors ${isLineSnapped ? 'border-yellow-400' : 'border-white'}`} 
        style={{ 
            top: screenY, 
            left: screenX, 
            transform: 'translate(-50%, -50%)', 
            backgroundColor: '#000' 
        }}
    >
        <canvas ref={canvasRef} width={size} height={size} className="w-full h-full object-cover" />
    </div>
  );
};

export default Magnifier;

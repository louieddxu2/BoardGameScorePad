
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentLayout, Rect } from '../../types';
import { Check, X, RotateCcw, MousePointerClick } from 'lucide-react';
import { cropImageToDataUrl } from '../../utils/imageProcessing';

interface LayoutEditorProps {
  initialLayout?: ContentLayout;
  onSave: (layout: ContentLayout | undefined) => void;
  onCancel: () => void;
  color: string;
  aspectRatio?: number;
  baseImage?: string; // New: Full score sheet image
  cellRect?: Rect;    // New: Coordinates to crop
}

const LayoutEditor: React.FC<LayoutEditorProps> = ({ initialLayout, onSave, onCancel, color, aspectRatio, baseImage, cellRect }) => {
  // Use percentages (0-100)
  const [rect, setRect] = useState<ContentLayout | null>(initialLayout || null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const startPos = useRef<{x: number, y: number} | null>(null);

  // --- Load Background Image ---
  useEffect(() => {
      if (baseImage && cellRect) {
          cropImageToDataUrl(baseImage, cellRect).then(setBgUrl);
      }
  }, [baseImage, cellRect]);

  const getPercentagePos = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const bounds = containerRef.current.getBoundingClientRect();
    let x = ((clientX - bounds.left) / bounds.width) * 100;
    let y = ((clientY - bounds.top) / bounds.height) * 100;
    
    // Clamp
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    // Round to 3 decimal places
    x = Math.round(x * 1000) / 1000;
    y = Math.round(y * 1000) / 1000;

    return { x, y };
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    const pos = getPercentagePos(clientX, clientY);
    setIsDrawing(true);
    startPos.current = pos;
    setRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  // Global mouse/touch handlers to ensure drag continues outside the box
  useEffect(() => {
    if (!isDrawing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (!startPos.current) return;
      const current = getPercentagePos(clientX, clientY);
      
      const x = Math.min(startPos.current.x, current.x);
      const y = Math.min(startPos.current.y, current.y);
      let width = Math.abs(current.x - startPos.current.x);
      let height = Math.abs(current.y - startPos.current.y);
      
      // Round width/height as well
      width = Math.round(width * 1000) / 1000;
      height = Math.round(height * 1000) / 1000;

      setRect({ x, y, width, height });
    };

    const handleEnd = () => {
      setIsDrawing(false);
      startPos.current = null;
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDrawing, getPercentagePos]);

  const handleReset = () => {
      setRect(null); // Reset to full (undefined layout)
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <h3 className="text-white font-bold flex items-center gap-2">
                <MousePointerClick size={20} className="text-emerald-500" />
                設定顯示區域
            </h3>
            <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"><X size={24}/></button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4 flex-1 bg-slate-800/50 overflow-y-auto">
            <p className="text-sm text-slate-400 text-center">
                在下方框格內拖曳，定義分數顯示的位置。<br/>
                <span className="text-xs opacity-70">(若未設定，則預設為置中顯示)</span>
            </p>
            
            {/* Wrapper to extend touch area */}
            <div
                className="relative p-2 -m-2 cursor-crosshair touch-none select-none w-full flex justify-center"
                onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
                onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            >
                {/* Simulation Container */}
                <div 
                    ref={containerRef}
                    className="relative w-full rounded-lg shadow-inner overflow-hidden border-4 border-slate-700"
                    style={{ 
                        aspectRatio: aspectRatio ? `${aspectRatio}` : '3/1',
                        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
                        backgroundSize: '100% 100%',
                        backgroundColor: bgUrl ? 'transparent' : 'white'
                    }}
                >
                    {/* Background Grid for visual guide (Only if no image) */}
                    {!bgUrl && (
                        <div className="absolute inset-0 opacity-10" 
                             style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        </div>
                    )}

                    {/* The Selection Box */}
                    {rect ? (
                        <div 
                            className="absolute bg-emerald-500/20 border-2 border-emerald-600 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            style={{
                                left: `${rect.x}%`,
                                top: `${rect.y}%`,
                                width: `${rect.width}%`,
                                height: `${rect.height}%`
                            }}
                        >
                            <span className="text-emerald-500 font-bold text-xl select-none drop-shadow-md" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>123</span>
                            {/* Dimensions Label */}
                            <div className="absolute -bottom-6 left-0 bg-slate-800 text-white text-[10px] px-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                {Math.round(rect.width)}% x {Math.round(rect.height)}%
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`font-bold text-4xl select-none ${bgUrl ? 'text-slate-900/50' : 'text-slate-300 opacity-50'}`}>123</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                <RotateCcw size={16} /> 重置 (全版)
            </button>
            <div className="flex gap-3">
                <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-bold">取消</button>
                <button onClick={() => onSave(rect || undefined)} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/50 flex items-center gap-2">
                    <Check size={18} /> 儲存設定
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LayoutEditor;

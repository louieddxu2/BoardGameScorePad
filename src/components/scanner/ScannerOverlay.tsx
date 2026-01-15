
import React from 'react';
import { Magnet, BoxSelect, ScanLine } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface ScannerOverlayProps {
  points: Point[];
  activePointIdx: number | null;
  isSnapping: boolean;
  snapType: 'none' | 'corner' | 'line';
  activeAngles: number[];
  geometricGhost: Point | null;
  scale: number;
  width: number;
  height: number;
  onPointStart: (index: number, e: React.MouseEvent | React.TouchEvent) => void;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  points,
  activePointIdx,
  isSnapping,
  snapType,
  activeAngles,
  geometricGhost,
  scale,
  width,
  height,
  onPointStart
}) => {
  if (points.length !== 4) return null;

  const polygonPoints = `${points[0].x},${points[0].y} ${points[1].x},${points[1].y} ${points[2].x},${points[2].y} ${points[3].x},${points[3].y}`;
  
  // Dynamic stroke widths based on zoom level to keep them visually consistent
  const strokeWidth = 2 / scale;
  const ghostScale = 1 / scale;

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${width} ${height}`} style={{zIndex: 10}}>
        <polygon 
            points={polygonPoints} 
            fill="rgba(6, 182, 212, 0.2)" 
            stroke="#22d3ee" 
            strokeWidth={strokeWidth} 
            vectorEffect="non-scaling-stroke"
        />
        {activePointIdx !== null && activeAngles.length > 0 && activeAngles.map((angle, idx) => {
            const p = points[activePointIdx];
            const rad = angle * Math.PI / 180;
            const dx = Math.cos(rad) * 10000; 
            const dy = Math.sin(rad) * 10000;
            return (
                <line 
                    key={`guide-${idx}`} 
                    x1={p.x - dx} y1={p.y - dy} 
                    x2={p.x + dx} y2={p.y + dy} 
                    stroke={snapType === 'line' ? '#facc15' : '#34d399'} 
                    strokeWidth={strokeWidth} 
                    strokeDasharray={snapType === 'line' ? '' : '8,8'} 
                    opacity="0.8" 
                    vectorEffect="non-scaling-stroke" 
                />
            );
        })}
      </svg>

      {geometricGhost && (
        <div 
            className="absolute w-6 h-6 -ml-3 -mt-3 z-10 pointer-events-none flex items-center justify-center opacity-70 animate-pulse" 
            style={{ 
                left: geometricGhost.x, 
                top: geometricGhost.y, 
                transform: `scale(${ghostScale})` 
            }}
        >
            <div className="w-full h-full border-2 border-dashed border-sky-400 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full absolute"></div>
        </div>
      )}

      {points.map((p, i) => (
        <div 
            key={i} 
            onMouseDown={(e) => onPointStart(i, e)} 
            onTouchStart={(e) => onPointStart(i, e)} 
            className="absolute w-12 h-12 -ml-6 -mt-6 z-20 cursor-move flex items-center justify-center group" 
            style={{ 
                left: p.x, 
                top: p.y, 
                transform: `scale(${ghostScale})` 
            }}
        >
            <div className={`w-5 h-5 rounded-full border-[3px] shadow-[0_0_2px_rgba(0,0,0,0.8)] transition-transform ${activePointIdx === i ? 'border-cyan-300 scale-125' : 'border-cyan-500'}`}></div>
            {activePointIdx === i && isSnapping && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-white text-[10px] px-2 py-1 rounded border border-slate-700 whitespace-nowrap pointer-events-none flex items-center gap-1 shadow-lg">
                    {geometricGhost && Math.sqrt(Math.pow(p.x - geometricGhost.x, 2) + Math.pow(p.y - geometricGhost.y, 2)) < (40 / scale) ? (
                        <><BoxSelect size={10} className="text-sky-400"/> 幾何吸附</>
                    ) : snapType === 'line' ? (
                        <><ScanLine size={10} className="text-yellow-400"/> 直線吸附</>
                    ) : (
                        <><Magnet size={10} className="text-slate-400"/> 自由移動</>
                    )}
                </div>
            )}
        </div>
      ))}
    </>
  );
};

export default ScannerOverlay;

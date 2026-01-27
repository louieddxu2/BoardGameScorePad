
import React from 'react';
import { Trash2, ScanLine } from 'lucide-react';
import { useTextureMapper } from './TextureMapperContext';

const GridPhase: React.FC = () => {
  const {
    sortedHLines,
    hLines,
    vLines,
    gridBounds,
    inverseScaleYStyle,
    inverseScaleXStyle,
    hLineChildStyle,
    vLineChildStyle,
    handlePointerDown,
    deleteLine,
    transform
  } = useTextureMapper();

  // Masks - Using robust CSS positioning
  // bg-black/50 corresponds to rgba(0,0,0,0.5)
  const maskClass = "absolute bg-black/50 pointer-events-none z-0";

  // Calculate inverse scale factor
  const s = transform.scale;

  // Style for labels attached to Horizontal Lines (Parent has scaleY(1/s))
  // We need to scale X by (1/s) to match, and keep Y as 1 (since parent shrinks Y)
  // Net Result: X=1/s, Y=1/s (Uniform)
  const hLabelStyle: React.CSSProperties = {
      transform: `translate(0, -50%) scale(${1/s}, 1)`,
      transformOrigin: 'right center', // Grow from right (towards left)
      zIndex: 50,
      whiteSpace: 'nowrap'
  };

  // Style for labels attached to Vertical Lines (Parent has scaleX(1/s))
  // We need to scale Y by (1/s) to match, and keep X as 1 (since parent shrinks X)
  // Net Result: X=1/s, Y=1/s (Uniform)
  const vLabelTopStyle: React.CSSProperties = {
      transform: `translate(-50%, 0) scale(1, ${1/s})`,
      transformOrigin: 'bottom center', // Grow upwards
      zIndex: 50,
      whiteSpace: 'nowrap'
  };

  const vLabelBottomStyle: React.CSSProperties = {
      transform: `translate(-50%, 0) scale(1, ${1/s})`,
      transformOrigin: 'top center', // Grow downwards
      zIndex: 50,
      whiteSpace: 'nowrap'
  };

  return (
    <div className="absolute inset-0 pointer-events-auto">
      {/* --- Masks (Cropped Areas) --- */}
      {/* Top Mask: Full Width */}
      <div 
        className={maskClass} 
        style={{ top: 0, left: 0, right: 0, height: `${gridBounds.top}%` }} 
      />
      
      {/* Bottom Mask: Full Width */}
      <div 
        className={maskClass} 
        style={{ bottom: 0, left: 0, right: 0, height: `${100 - gridBounds.bottom}%` }} 
      />
      
      {/* Left Mask: Constrained Vertical */}
      <div 
        className={maskClass} 
        style={{ 
            left: 0, 
            top: `${gridBounds.top}%`, 
            height: `${gridBounds.bottom - gridBounds.top}%`,
            width: `${gridBounds.left}%` 
        }} 
      />
      
      {/* Right Mask: Constrained Vertical */}
      <div 
        className={maskClass} 
        style={{ 
            right: 0, 
            top: `${gridBounds.top}%`, 
            height: `${gridBounds.bottom - gridBounds.top}%`,
            width: `${100 - gridBounds.right}%` 
        }} 
      />

      {/* --- Boundary Lines (Draggable) --- */}
      
      {/* Top Bound */}
      <div
        className="absolute left-0 right-0 h-[2px] group bg-emerald-500 cursor-row-resize z-40"
        style={{ top: `${gridBounds.top}%`, ...inverseScaleYStyle }}
        onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'top' })}
        onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'top' })}
      >
         <div className="absolute -top-4 bottom-4 left-0 right-0 bg-transparent" />
         {/* Position: Outside Left, Centered Vertically relative to line */}
         <div 
            className="absolute right-[100%] top-[50%] mr-4 flex items-center justify-end" 
            style={hLabelStyle}
         >
             <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow flex items-center gap-1 border border-emerald-400">
                 <ScanLine size={12} /> 頂部邊界
             </div>
         </div>
      </div>

      {/* Bottom Bound */}
      <div
        className="absolute left-0 right-0 h-[2px] group bg-emerald-500 cursor-row-resize z-40"
        style={{ top: `${gridBounds.bottom}%`, ...inverseScaleYStyle }}
        onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'bottom' })}
        onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'bottom' })}
      >
         <div className="absolute -top-4 bottom-4 left-0 right-0 bg-transparent" />
         {/* Position: Outside Left, Centered Vertically relative to line */}
         <div 
            className="absolute right-[100%] top-[50%] mr-4 flex items-center justify-end" 
            style={hLabelStyle}
         >
             <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow flex items-center gap-1 border border-emerald-400">
                 <ScanLine size={12} /> 底部邊界
             </div>
         </div>
      </div>

      {/* Left Bound */}
      <div
        className="absolute top-0 bottom-0 w-[2px] group bg-emerald-500 cursor-col-resize z-40"
        style={{ left: `${gridBounds.left}%`, top: `${gridBounds.top}%`, height: `${gridBounds.bottom - gridBounds.top}%`, ...inverseScaleXStyle }}
        onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'left' })}
        onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'left' })}
      >
         <div className="absolute -left-4 right-4 top-0 bottom-0 bg-transparent" />
         {/* Position: Outside Top, Centered Horizontally relative to line */}
         <div 
            className="absolute bottom-[100%] left-[50%] mb-4 flex flex-col items-center" 
            style={vLabelTopStyle}
         >
             <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow whitespace-nowrap border border-emerald-400">左邊界</div>
         </div>
      </div>

      {/* Right Bound */}
      <div
        className="absolute top-0 bottom-0 w-[2px] group bg-emerald-500 cursor-col-resize z-40"
        style={{ left: `${gridBounds.right}%`, top: `${gridBounds.top}%`, height: `${gridBounds.bottom - gridBounds.top}%`, ...inverseScaleXStyle }}
        onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'right' })}
        onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'bound', boundType: 'right' })}
      >
         <div className="absolute -left-4 right-4 top-0 bottom-0 bg-transparent" />
         {/* Position: Outside Top, Centered Horizontally relative to line */}
         <div 
            className="absolute bottom-[100%] left-[50%] mb-4 flex flex-col items-center" 
            style={vLabelTopStyle}
         >
             <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow whitespace-nowrap border border-emerald-400">右邊界</div>
         </div>
      </div>


      {/* --- Internal Horizontal Lines --- */}
      {sortedHLines.map((y, i) => {
        if (Math.abs(y - gridBounds.top) < 0.1 || Math.abs(y - gridBounds.bottom) < 0.1) return null;

        const originalIndex = hLines.indexOf(y);
        const isUserLine = originalIndex !== -1;
        
        return (
          <div
            key={`h-${i}`}
            className="absolute h-[2px] group bg-sky-400/80 hover:bg-yellow-400 cursor-row-resize"
            style={{ 
                top: `${y}%`, 
                left: `${gridBounds.left}%`,
                width: `${gridBounds.right - gridBounds.left}%`,
                ...inverseScaleYStyle 
            }}
            onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'h', index: originalIndex })}
            onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'h', index: originalIndex })}
          >
            <div className="absolute -top-4 bottom-4 left-0 right-0 bg-transparent"></div>
            {/* Internal lines use hLineChildStyle from context, which is scale(1/s, 1) */}
            <div className="absolute right-[100%] mr-2 top-0 flex items-center justify-end" style={hLineChildStyle}>
              <div className="flex items-center gap-1 -translate-y-1/2">
                {isUserLine && (
                  <button onClick={(e) => { e.stopPropagation(); deleteLine('h', originalIndex); }} className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                )}
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-sm border ${!isUserLine ? 'bg-slate-800/80 text-slate-500 border-slate-700' : 'bg-sky-600 text-white border-sky-500'}`}>
                  Line {i}
                </div>
                <div className={`w-2 h-[1px] ${!isUserLine ? 'bg-slate-700' : 'bg-sky-400'}`}></div>
              </div>
            </div>
          </div>
        );
      })}

      {/* --- Vertical Lines & Guides --- */}
      <>
        {/* Item Right Boundary */}
        <div
          className="absolute top-0 bottom-0 w-[2px] group bg-cyan-400 hover:bg-cyan-300 cursor-col-resize pointer-events-auto"
          style={{ left: `${vLines[0]}%`, top: `${gridBounds.top}%`, height: `${gridBounds.bottom - gridBounds.top}%`, ...inverseScaleXStyle, zIndex: 30 }}
          onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'v', index: 0 })}
          onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'v', index: 0 })}
        >
          <div className="absolute -left-4 right-4 top-0 bottom-0 bg-transparent"></div>
          {/* Position: Outside Bottom */}
          <div 
            className="absolute top-[100%] left-[50%] mt-4 flex flex-col items-center" 
            style={vLabelBottomStyle}
          >
            <div className="h-4 w-[1px] bg-cyan-400 absolute top-0 left-1/2 -translate-x-1/2 -mt-4"></div>
            <div className="bg-cyan-600 text-white px-2 py-1 rounded text-xs font-bold shadow whitespace-nowrap border border-cyan-500">項目右邊界</div>
          </div>
        </div>
        
        {/* Player 1 Right Boundary */}
        <div
          className="absolute top-0 bottom-0 w-[2px] group bg-emerald-400 hover:bg-emerald-300 cursor-col-resize pointer-events-auto"
          style={{ left: `${vLines[1]}%`, top: `${gridBounds.top}%`, height: `${gridBounds.bottom - gridBounds.top}%`, ...inverseScaleXStyle, zIndex: 30 }}
          onMouseDown={(e) => handlePointerDown(e, 'line', { type: 'v', index: 1 })}
          onTouchStart={(e) => handlePointerDown(e, 'line', { type: 'v', index: 1 })}
        >
          <div className="absolute -left-4 right-4 top-0 bottom-0 bg-transparent"></div>
          {/* Position: Outside Top */}
          <div 
            className="absolute bottom-[100%] left-[50%] mb-4 flex flex-col items-center" 
            style={vLabelTopStyle}
          >
            <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow whitespace-nowrap border border-emerald-500">首位玩家欄右邊界</div>
            <div className="h-4 w-[1px] bg-emerald-400 absolute bottom-0 left-1/2 -translate-x-1/2 -mb-4"></div>
          </div>
        </div>
        
        {/* Guides */}
        {(() => {
          // Adjust width calculation to account for Left Bound
          const colWidth = vLines[1] - vLines[0];
          if (colWidth <= 1) return null;
          const guides = [];
          let currentLeft = vLines[1] + colWidth;
          // Loop until it hits the Right Bound
          while (currentLeft < gridBounds.right) {
            guides.push(
              <div
                key={`v-guide-${currentLeft}`}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ 
                    left: `${currentLeft}%`, 
                    top: `${gridBounds.top}%`, 
                    height: `${gridBounds.bottom - gridBounds.top}%`,
                    width: 0, 
                    borderLeft: `2px dashed white`, 
                    opacity: 0.4, 
                    transform: `scaleX(${1 / transform.scale})`, 
                    transformOrigin: 'left' 
                }}
              />
            );
            currentLeft += colWidth;
          }
          return guides;
        })()}
      </>
    </div>
  );
};

export default GridPhase;

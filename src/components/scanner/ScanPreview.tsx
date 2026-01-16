
import React, { useRef, useState } from 'react';
import { Download, Edit3, Check } from 'lucide-react';
import { GameTemplate } from '../../types';
import { usePanZoom } from '../../hooks/usePanZoom';

interface ScanPreviewProps {
  imageSrc: string;
  template?: GameTemplate;
  onBack: () => void;
  onConfirm: (intent: 'save' | 'edit_grid') => void;
}

const ScanPreview: React.FC<ScanPreviewProps> = ({ imageSrc, template, onBack, onConfirm }) => {
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { transform, panZoomHandlers, fitToScreen } = usePanZoom({ containerRef });
  const [imgSize, setImgSize] = useState<{w: number, h: number} | null>(null);

  const handleSaveToDevice = async () => {
    try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const file = new File([blob], `score-sheet-${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: '已校正計分表' });
        } else {
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = `score-sheet-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e: any) {
        if (e.name !== 'AbortError') console.error("Save/Share failed", e);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImgSize({ w, h });
      fitToScreen(w, h);
  };

  const renderGridOverlay = () => {
      if (!template || !template.globalVisuals) return null;
      
      const visuals = template.globalVisuals;
      const columns = template.columns;
      
      const toPct = (val: number) => `${val * 100}%`;
      
      // Helper to convert rect to style with optional horizontal offset
      const rectToStyle = (
          r: { x: number, y: number, width: number, height: number } | undefined, 
          borderColor: string = '#facc15', 
          xOffset: number = 0,
          opacity: number = 0.6
      ) => {
          if (!r) return { display: 'none' };
          
          // Check if rect is out of bounds (allows simple clipping)
          if (r.x + xOffset + r.width > 1.05) return { display: 'none' };

          return {
              position: 'absolute' as const,
              left: toPct(r.x + xOffset),
              top: toPct(r.y),
              width: toPct(r.width),
              height: toPct(r.height),
              border: `1px solid ${borderColor}`,
              boxShadow: '0 0 2px rgba(0,0,0,0.3)', 
              pointerEvents: 'none' as const,
              opacity: opacity
          };
      };

      // Determine the width of one player column (the stride)
      const playerColWidth = visuals.playerHeaderRect?.width || 0;
      
      // How many ghost players to show? Let's show up to 4 or until edge.
      const PREVIEW_PLAYER_COUNT = playerColWidth > 0 ? Math.min(6, Math.floor((1 - (visuals.playerLabelRect?.width || 0)) / playerColWidth)) : 1;

      return (
          <div className="absolute inset-0 pointer-events-none z-10">
              {/* --- 1. Static Left Column (Yellow/Gold) --- */}
              <div style={rectToStyle(visuals.playerLabelRect, '#facc15')} />
              <div style={rectToStyle(visuals.totalLabelRect, '#facc15')} />
              
              {/* Column Headers (Blue) */}
              {columns.map((col, idx) => {
                  if (col.displayMode === 'hidden') return null;
                  return <div key={`head-${idx}`} style={rectToStyle(col.visuals?.headerRect, '#38bdf8')} />;
              })}

              {/* --- 2. Repeated Player Columns --- */}
              {Array.from({ length: PREVIEW_PLAYER_COUNT }).map((_, i) => {
                  const xOffset = i * playerColWidth;
                  const isFirst = i === 0;
                  // First player (actual reference) is solid, ghosts are slightly more transparent
                  const opacity = isFirst ? 0.6 : 0.3; 
                  const borderColorModifier = isFirst ? '' : '80'; // Hex alpha

                  return (
                      <React.Fragment key={`p-${i}`}>
                          {/* Player Header Area (Top Row) */}
                          <div style={rectToStyle(visuals.playerHeaderRect, '#facc15' + borderColorModifier, xOffset, opacity)} />
                          
                          {/* Total Score Area (Bottom Row) */}
                          <div style={rectToStyle(visuals.totalRowRect, '#facc15' + borderColorModifier, xOffset, opacity)} />

                          {/* Data Cells (Green) */}
                          {columns.map((col, idx) => {
                              if (col.displayMode === 'hidden') return null;
                              return (
                                  <div 
                                    key={`cell-${i}-${idx}`} 
                                    style={rectToStyle(col.visuals?.cellRect, '#34d399' + borderColorModifier, xOffset, opacity)} 
                                  />
                              );
                          })}
                      </React.Fragment>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
        <header className="flex-none p-4 bg-slate-900 border-b border-slate-800 flex justify-center items-center z-50">
            <h2 className="text-white font-bold">預覽與確認</h2>
        </header>
        
        <main 
            className="flex-1 w-full h-full relative overflow-hidden bg-black/50 touch-none select-none"
            ref={containerRef}
            onMouseDown={panZoomHandlers.onMouseDown}
            onTouchStart={panZoomHandlers.onTouchStart}
            onWheel={panZoomHandlers.onWheel}
        >
           <div 
                className="absolute top-0 left-0 origin-top-left will-change-transform shadow-2xl"
                style={{ 
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    width: imgSize ? imgSize.w : 'auto',
                    height: imgSize ? imgSize.h : 'auto'
                }}
           >
               <img 
                    src={imageSrc} 
                    className="block pointer-events-none select-none w-full h-full object-contain" 
                    alt="校正結果" 
                    draggable={false}
                    onLoad={handleImageLoad}
                />
               {renderGridOverlay()}
           </div>
        </main>

        <footer className="flex-none w-full p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-50">
           <button onClick={onBack} className="px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 font-bold text-sm">返回調整</button>
           
           <div className="flex items-center gap-2">
                <button onClick={handleSaveToDevice} className="px-3 py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700 font-bold text-sm" title="儲存圖片到裝置">
                    <Download size={20} />
                </button>

                {template && (
                    <button onClick={() => onConfirm('edit_grid')} className="px-4 py-3 bg-sky-700 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm border border-sky-600">
                        <Edit3 size={18} /> 修改網格
                    </button>
                )}
                <button onClick={() => onConfirm('save')} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg flex items-center gap-2">
                    <Check size={24} />
                </button>
           </div>
        </footer>
    </div>
  );
};

export default ScanPreview;

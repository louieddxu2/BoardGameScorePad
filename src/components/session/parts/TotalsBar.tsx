
import React, { useEffect, useState, useMemo } from 'react';
import { GameTemplate, Player } from '../../../types';
import TexturedTotalCell from './TexturedTotalCell';
import TexturedBlock from './TexturedBlock';

interface TotalsBarProps {
  players: Player[];
  winners: string[];
  isPanelOpen: boolean;
  panelHeight: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isHidden?: boolean;
  template?: GameTemplate; 
  baseImage?: string; 
  editingCell?: { playerId: string, colId: string } | null;
  previewValue?: any;
  onTotalClick?: (playerId: string) => void;
  zoomLevel?: number; // Added prop
}

const TotalsBar: React.FC<TotalsBarProps> = ({
  players,
  winners,
  isPanelOpen,
  panelHeight,
  scrollRef,
  contentRef,
  isHidden = false,
  template,
  baseImage,
  editingCell,
  previewValue,
  onTotalClick,
  zoomLevel = 1, // Default to 1
}) => {
  const [imageDims, setImageDims] = useState<{width: number, height: number} | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // [Simplified Logic] Mode depends strictly on baseImage presence.
  const isTextureMode = !!baseImage;

  // Load dims if image exists (for width calculation)
  useEffect(() => {
      if (baseImage) {
          const img = new Image();
          img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = baseImage;
      } else {
          setImageDims(null);
      }
  }, [baseImage]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const measureContainer = () => {
        if (!scrollRef.current) return;
        const width = scrollRef.current.parentElement!.clientWidth;
        window.requestAnimationFrame(() => {
            setContainerWidth(width);
        });
    };
    measureContainer();
    const observer = new ResizeObserver(() => {
        measureContainer();
    });
    observer.observe(scrollRef.current.parentElement!);
    return () => observer.disconnect();
  }, [scrollRef]);

  const itemColStyle = useMemo(() => {
      // 1. Texture Mode: Use loaded dimensions
      // [FIX] totalLabelRect.width is now normalized (0-1). Do not divide by imageDims.width.
      if (isTextureMode && imageDims && template?.globalVisuals?.totalLabelRect) {
          const { totalLabelRect } = template.globalVisuals;
          // Direct proportion (0-1)
          const itemColProportion = totalLabelRect.width;
          const scaledWidth = containerWidth * itemColProportion * zoomLevel;
          return { 
              width: `${scaledWidth}px`, 
              minWidth: `${scaledWidth}px`,
              flexShrink: 0 
          };
      }
      
      // 2. Standard Mode or Texture Mode (loading): Dynamic calculation
      if (containerWidth > 0) {
          const width = Math.max(70, containerWidth / (players.length + 2));
          return { width: `${width}px`, minWidth: `${width}px`, flexShrink: 0 };
      }

      return { width: '70px', minWidth: '70px', flexShrink: 0 }; // Fallback

  }, [isTextureMode, imageDims, template?.globalVisuals, containerWidth, zoomLevel, players.length]);

  return (
    <div
      id="live-totals-bar"
      className={`absolute left-0 right-0 border-t border-slate-700 flex z-30 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${isPanelOpen ? 'bg-slate-900/75 backdrop-blur' : 'bg-slate-900'} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${isTextureMode ? 'min-h-0' : 'min-h-[2.5rem]'}`}
      style={{ bottom: panelHeight }}
    >
      <TexturedBlock 
        baseImage={baseImage}
        rect={template?.globalVisuals?.totalLabelRect}
        fallbackContent={<span className="font-black text-emerald-400 text-sm">總分</span>}
        className={`bg-slate-800 border-r border-slate-700 flex items-center justify-center shrink-0 z-40 relative border-t-2 ${isTextureMode ? 'p-0 border-transparent' : 'p-2 border-slate-700'}`}
        style={itemColStyle}
      />
      <div className="flex-1 overflow-hidden" ref={scrollRef}>
        <div 
            className="flex min-w-fit h-full"
            ref={contentRef}
        >
          {players.map((p, index) => (
            <TexturedTotalCell
                key={p.id}
                player={p}
                playerIndex={index}
                isWinner={winners.includes(p.id)}
                hasMultiplePlayers={players.length > 1}
                baseImage={baseImage || ''}
                rect={template?.globalVisuals?.totalRowRect}
                limitX={template?.globalVisuals?.rightMaskRect?.x}
                isActive={editingCell?.colId === '__TOTAL__' && editingCell?.playerId === p.id}
                previewValue={editingCell?.colId === '__TOTAL__' && editingCell?.playerId === p.id ? previewValue : undefined}
                onClick={() => onTotalClick && onTotalClick(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TotalsBar;

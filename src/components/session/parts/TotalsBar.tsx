
import React, { useEffect, useState, useMemo } from 'react';
import { GameTemplate, Player } from '../../../types';
import { Crown } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import TexturedTotalCell from './TexturedTotalCell';
import { cropImageToDataUrl } from '../../../utils/imageProcessing';

interface TotalsBarProps {
  players: Player[];
  winners: string[];
  isPanelOpen: boolean;
  panelHeight: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isHidden?: boolean;
  // Needs template to access global visuals
  template?: GameTemplate; 
  baseImage?: string; 
  // New Props for interactivity
  editingCell?: { playerId: string, colId: string } | null;
  previewValue?: any;
  onTotalClick?: (playerId: string) => void;
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
  onTotalClick
}) => {
  const [labelBgUrl, setLabelBgUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{width: number, height: number} | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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
    // We assume the scrollRef for the totals bar will reflect the overall container width.
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
      if (!baseImage || !imageDims || !template?.globalVisuals?.totalLabelRect || containerWidth === 0) {
          return {};
      }
      const { totalLabelRect } = template.globalVisuals;
      if (!totalLabelRect) return {};

      const itemColProportion = totalLabelRect.width / imageDims.width;
      
      return { 
          width: `${containerWidth * itemColProportion}px`, 
          minWidth: `${containerWidth * itemColProportion}px`,
          flexShrink: 0 
      };

  }, [baseImage, imageDims, template?.globalVisuals, containerWidth]);

  useEffect(() => {
      if (baseImage && template?.globalVisuals?.totalLabelRect) {
          cropImageToDataUrl(baseImage, template.globalVisuals.totalLabelRect).then(setLabelBgUrl);
      } else {
          setLabelBgUrl(null);
      }
  }, [baseImage, template?.globalVisuals?.totalLabelRect]);

  const finalLabelStyle: React.CSSProperties = { ...itemColStyle };
  if (labelBgUrl) {
      finalLabelStyle.backgroundImage = `url(${labelBgUrl})`;
      finalLabelStyle.backgroundSize = '100% 100%';
      finalLabelStyle.backgroundRepeat = 'no-repeat';
      finalLabelStyle.border = 'none';
  }

  // Preserve aspect ratio if defined, for height calculation
  if (template?.globalVisuals?.totalLabelRect) {
      const { width, height } = template.globalVisuals.totalLabelRect;
      if (width > 0 && height > 0) {
          (finalLabelStyle as any).aspectRatio = `${width} / ${height}`;
      }
  }

  return (
    <div
      id="live-totals-bar"
      // Changed h-10 to min-h-[2.5rem] to allow expansion based on aspect ratio
      className={`absolute left-0 right-0 min-h-[2.5rem] border-t border-slate-700 flex z-30 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${isPanelOpen ? 'bg-slate-900/75 backdrop-blur' : 'bg-slate-900'} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ bottom: panelHeight }}
    >
      <div 
        className="w-[70px] bg-slate-800 border-r border-slate-700 flex items-center justify-center shrink-0 z-40 relative border-t-2 border-transparent"
        style={finalLabelStyle}
      >
        {!labelBgUrl && <span className="font-black text-emerald-400 text-sm">總分</span>}
      </div>
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
                // Pass right mask boundary for limit calculation
                limitX={template?.globalVisuals?.rightMaskRect?.x}
                // Interactive Props
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

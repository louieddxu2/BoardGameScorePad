
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Player } from '../../../types';
import { getSmartTextureUrl } from '../../../utils/imageProcessing';
import { getContrastTextStyles } from '../../../utils/ui';
import { ContrastText } from '../../shared/ContrastText';
import { Crown, X } from 'lucide-react';
import SmartTextureLayer from './SmartTextureLayer';
import { COLORS } from '../../../colors';
import { getRawValue } from '../../../utils/scoring';
// [Fix] 匯入堆疊查詢，用於判斷是否有「非輸入面板」的 Modal 正在開啟
const INPUT_PANEL_IDS = ['session-input-panel', 'session-title-edit'];
const hasOverlayModals = (): boolean => {
    const stack: string[] = (window as any).__modalStack || [];
    return stack.some(id => !INPUT_PANEL_IDS.includes(id));
};

// --- Floating Bubble Component ---
const FloatingBubble: React.FC<{
    anchorRef: React.RefObject<HTMLElement>;
    displayValue: string | number;
    color: string;
}> = ({ anchorRef, displayValue, color }) => {
    const bubbleRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        let frameId: number;

        const updatePosition = () => {
            const anchor = anchorRef.current;
            const bubble = bubbleRef.current;
            if (!anchor || !bubble) return;

            const anchorRect = anchor.getBoundingClientRect();
            // const bubbleRect = bubble.getBoundingClientRect();

            const gap = 8;
            // Center bubble horizontally relative to cell, but position it above
            // Use cell's top-left corner as anchor point for calculation
            const top = anchorRect.top - bubble.offsetHeight - gap;
            const left = anchorRect.left;

            bubble.style.transform = `translate3d(${left}px, ${top}px, 0)`;
            
            // Check visibility
            if (anchorRect.bottom < 0 || anchorRect.top > window.innerHeight) {
                bubble.style.opacity = '0';
            } else {
                bubble.style.opacity = '1';
            }
        };

        const loop = () => {
            updatePosition();
            frameId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(frameId);
    }, [anchorRef]);

    return createPortal(
        <div
            ref={bubbleRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none will-change-transform flex flex-col items-start"
            style={{ 
                transform: 'translate3d(-1000px, -1000px, 0)',
                transition: 'opacity 0.1s' 
            }}
        >
            <div 
                className="px-3 py-1.5 rounded-xl shadow-xl bg-modal-bg-elevated border-2 text-base font-black font-mono animate-in zoom-in-95 duration-200"
                style={{ 
                    borderColor: color, 
                    color: color,
                    boxShadow: `0 4px 12px rgba(var(--c-black)/0.5)`
                }}
            >
                {displayValue}
            </div>
            {/* Triangle pointing down-left */}
            <div 
                className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] -mt-[1px] ml-4"
                style={{ borderTopColor: color }}
            ></div>
        </div>,
        document.body
    );
};

interface TexturedTotalCellProps {
  player: Player;
  playerIndex: number;
  isWinner: boolean;
  hasMultiplePlayers: boolean;
  baseImage: string;
  rect?: { x: number, y: number, width: number, height: number };
  className?: string;
  style?: React.CSSProperties;
  hideCrown?: boolean; 
  limitX?: number;
  isActive?: boolean;
  previewValue?: any;
  onClick?: () => void;
  cleanMode?: boolean; // [New] If true, hides all icons (crown, x, arrows) and ignores fading
}

// RESTORED & ADJUSTED: Annotation Arrow Visual
// Visual indicator for manual score adjustments
// Update: Dots moved higher (y=15), Gap increased (Line start y=35)
const AnnotationArrow: React.FC = () => (
    <svg 
        viewBox="0 0 100 100" 
        className="absolute top-0 left-0 w-[20%] h-full pointer-events-none text-brand-secondary opacity-80"
        style={{ zIndex: 15 }}
    >
        {/* Dots moved higher (y=15) to increase gap from line */}
        <circle cx="35" cy="15" r="4" fill="currentColor" />
        <circle cx="50" cy="15" r="4" fill="currentColor" />
        <circle cx="65" cy="15" r="4" fill="currentColor" />
        
        {/* Line starts lower (y=35) to increase gap */}
        <path 
            d="M 50 35 V 55 H 85" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        
        {/* Arrow head at (85, 55) */}
        <path 
            d="M 80 50 L 90 55 L 80 60" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const TexturedTotalCell: React.FC<TexturedTotalCellProps> = ({
  player,
  playerIndex,
  isWinner,
  hasMultiplePlayers,
  baseImage,
  rect,
  className,
  style,
  hideCrown = false,
  limitX,
  isActive,
  previewValue,
  onClick,
  cleanMode = false
}) => {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    if (baseImage && rect) {
        getSmartTextureUrl(baseImage, rect, playerIndex, limitX).then((url) => {
            if (isMounted) setBgUrl(url || null);
        });
    } else {
        setBgUrl(null);
    }
    return () => { isMounted = false; };
  }, [baseImage, rect, playerIndex, limitX]);

  // --- Logic ---
  const hasTexture = !!(baseImage && rect);
  
  // [Fix] Fallback color logic for standard mode (copied from TexturedPlayerHeader)
  // If no baseImage is loaded, force a fallback color even if player is transparent
  const isFallbackMode = !baseImage;
  const effectiveColor = (isFallbackMode && player.color === 'transparent') 
      ? COLORS[playerIndex % COLORS.length] 
      : player.color;

  const isTransparent = effectiveColor === 'transparent';
  const uiColor = isTransparent ? COLORS[playerIndex % COLORS.length] : effectiveColor;

  const containerStyle: React.CSSProperties = {
      backgroundColor: bgUrl ? 'transparent' : (isTransparent ? 'transparent' : 'rgb(var(--c-grid-cell-bg))'),
      borderTopColor: isTransparent ? 'transparent' : effectiveColor,
      borderTopWidth: isTransparent || hasTexture ? '0px' : '4px',
      // [Fix]: Set minHeight to 0px if texture is successfully loaded.
      // Otherwise default to 2.5rem to match TotalsBar standard height.
      minHeight: bgUrl ? '0px' : '2.5rem', 
      ...style,
  };

  const hasAnyScores = Object.keys(player.scores).length > 0;
  const showClickHint = !hasTexture && !hasAnyScores && !isActive && !player.bonusScore && onClick;

  const hasBonus = !!player.bonusScore;
  const isForceLost = !!player.isForceLost;
  
  // [Clean Mode Logic] If active, force disable visual effects of "Force Lost" (fading/coloring)
  const visualForceLost = cleanMode ? false : isForceLost;

  const inkStyle: React.CSSProperties = bgUrl ? {
      fontFamily: '"Kalam", "Caveat", cursive',
      transform: `rotate(${((player.id.charCodeAt(0)) % 5) - 2}deg)`,
      mixBlendMode: 'multiply',
      textShadow: 'none',
  } : {};

  // --- Display Value Logic for Bubble ---
  let bubbleDisplay: string | number = '';
  if (isActive) {
      // If it's a string (e.g. "-0" or "5."), use it directly to preserve formatting
      if (typeof previewValue === 'string') {
          bubbleDisplay = previewValue;
      } else {
          // It's a number (from initialization or reset)
          const num = getRawValue(previewValue);
          // [UPDATED] Just display the raw number (Absolute Score)
          bubbleDisplay = String(num);
          
          // Corner case: if it is explicitly -0 number
          if (Object.is(num, -0)) bubbleDisplay = '-0';
      }
  }

  return (
    <div
      key={player.id}
      ref={cellRef}
      className={`player-col-${player.id} flex-none min-w-[3.375rem] flex flex-col items-center justify-center relative overflow-visible group 
        ${!bgUrl ? 'border-r border-surface-border' : ''} 
        ${onClick ? 'cursor-pointer hover:bg-surface-hover/10' : ''} 
        ${className}`}
      style={containerStyle}
      onClick={onClick}
    >
      {/* Active Indicator */}
      {!hasTexture && isActive && <div className="absolute inset-0 ring-2 ring-inset ring-[rgb(var(--c-grid-active-ring))] z-30 pointer-events-none"></div>}
      
      {/* Empty State Hint */}
      {showClickHint && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border-2 border-dashed border-txt-muted/30 rounded-lg pointer-events-none group-hover:border-txt-muted/50 transition-colors"></div>
      )}

      <SmartTextureLayer bgUrl={bgUrl} rect={rect} />

      {/* RESTORED: Bonus Annotation Arrow (Shows if bonus exists, even if not textured, for consistency) */}
      {/* Condition: Show if there is a bonus score AND not force lost AND NOT cleanMode */}
      {!cleanMode && hasBonus && !isForceLost && <AnnotationArrow />}

      <ContrastText 
        className="font-black text-2xl leading-none w-full text-center truncate px-1 z-10" 
        color={bgUrl ? (visualForceLost ? 'rgba(var(--c-slate-500)/0.5)' : 'rgb(var(--c-txt-on-dark))') : (visualForceLost ? 'rgb(var(--c-status-danger))' : (isTransparent ? 'rgb(var(--c-txt-muted))' : effectiveColor))}
        style={bgUrl ? inkStyle : { opacity: visualForceLost ? 0.5 : 1 }}
        isTextureMode={!!bgUrl}
      >
        {player.totalScore}
      </ContrastText>

      {/* Force Loss Marker - Hidden in Clean Mode */}
      {!cleanMode && isForceLost && (
          <div className="absolute top-0.5 right-0.5 z-20 pointer-events-none drop-shadow-md">
              <X className="text-status-danger/80" size={16} strokeWidth={3} />
          </div>
      )}

      {/* Winner Crown - Hidden in Clean Mode */}
      {!cleanMode && !hideCrown && isWinner && hasMultiplePlayers && !isForceLost && (
        <Crown size={14} className="text-status-warning absolute top-0.5 right-0.5 z-20 shadow-sm" fill="currentColor" />
      )}

      {/* Floating Preview Bubble (Anchored Portal) */}
      {/* [Fix] 當有任何 Modal 開啟時隱藏氣泡，避免 Portal z-index 壓過彈窗 */}
      {isActive && !hasOverlayModals() && (
          <FloatingBubble 
              anchorRef={cellRef}
              displayValue={bubbleDisplay}
              color={uiColor}
          />
      )}

      {bgUrl && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(var(--c-black)/0.05)] pointer-events-none z-0" />}
    </div>
  );
};

export default TexturedTotalCell;

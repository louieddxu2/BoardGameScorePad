
import React, { useEffect, useState } from 'react';
import { Player } from '../../../types';
import { getSmartTextureUrl } from '../../../utils/imageProcessing';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { Crown } from 'lucide-react';
import SmartTextureLayer from './SmartTextureLayer';
import { COLORS } from '../../../colors'; // Import

interface TexturedTotalCellProps {
  player: Player;
  playerIndex: number;
  isWinner: boolean;
  hasMultiplePlayers: boolean;
  baseImage: string;
  rect?: { x: number, y: number, width: number, height: number };
  className?: string;
  style?: React.CSSProperties;
  hideCrown?: boolean; // New Prop
  limitX?: number; // New Prop for Right Bound limit
}

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
  limitX
}) => {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (baseImage && rect) {
        getSmartTextureUrl(baseImage, rect, playerIndex, limitX).then((url) => {
            if (isMounted) setBgUrl(url);
        });
    }
    return () => { isMounted = false; };
  }, [baseImage, rect, playerIndex, limitX]);

  // Fallback color logic
  const isFallbackMode = !baseImage;
  const effectiveColor = (isFallbackMode && player.color === 'transparent') 
      ? COLORS[playerIndex % COLORS.length] 
      : player.color;

  const isTransparent = effectiveColor === 'transparent';
  const hasTexture = !!(baseImage && rect);

  const containerStyle: React.CSSProperties = {
      backgroundColor: hasTexture ? 'transparent' : (isTransparent ? 'transparent' : `${effectiveColor}20`),
      borderTopColor: isTransparent ? 'transparent' : effectiveColor,
      borderTopWidth: isTransparent || hasTexture ? '0px' : '2px',
      ...style,
  };

  const inkStyle: React.CSSProperties = hasTexture ? {
      fontFamily: '"Kalam", "Caveat", cursive',
      color: 'rgba(28, 35, 51, 0.95)',
      transform: `rotate(${((player.id.charCodeAt(0)) % 5) - 2}deg)`,
      mixBlendMode: 'multiply',
      textShadow: 'none',
  } : {
      color: isTransparent ? '#e2e8f0' : effectiveColor,
      ...((isTransparent || isColorDark(effectiveColor)) && { textShadow: ENHANCED_TEXT_SHADOW })
  };

  return (
    <div
      key={player.id}
      className={`player-col-${player.id} flex-none min-w-[3.375rem] flex flex-col items-center justify-center relative overflow-hidden ${!hasTexture ? 'border-r border-slate-800' : ''} ${className}`}
      style={containerStyle}
    >
      <SmartTextureLayer bgUrl={bgUrl} rect={rect} />

      <span className="font-black text-2xl leading-none w-full text-center truncate px-1 z-10" style={inkStyle}>
        {player.totalScore}
      </span>
      {!hideCrown && isWinner && hasMultiplePlayers && (
        <Crown size={14} className="text-yellow-400 absolute top-0.5 right-0.5 z-20 shadow-sm" fill="currentColor" />
      )}
      {hasTexture && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-0" />}
    </div>
  );
};

export default TexturedTotalCell;

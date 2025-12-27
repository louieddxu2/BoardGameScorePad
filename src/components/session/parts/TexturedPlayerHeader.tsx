
import React, { useEffect, useState } from 'react';
import { Player } from '../../../types';
import { getSmartTextureUrl } from '../../../utils/imageProcessing';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import SmartTextureLayer from './SmartTextureLayer';
import { COLORS } from '../../../colors'; // Import colors for fallback

interface TexturedPlayerHeaderProps {
  player: Player;
  playerIndex: number;
  baseImage: string;
  rect?: { x: number, y: number, width: number, height: number };
  onClick: (e: React.MouseEvent) => void;
  isEditing: boolean;
  className?: string;
  style?: React.CSSProperties;
  limitX?: number; // New Prop for Right Bound limit
}

const TexturedPlayerHeader: React.FC<TexturedPlayerHeaderProps> = ({
  player,
  playerIndex,
  baseImage,
  rect,
  onClick,
  isEditing,
  className,
  style,
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

  // If no baseImage is loaded, force a fallback color even if player is transparent
  // This handles the "Skipped Image Upload" scenario for textured templates
  const isFallbackMode = !baseImage;
  const effectiveColor = (isFallbackMode && player.color === 'transparent') 
      ? COLORS[playerIndex % COLORS.length] 
      : player.color;

  const isTransparent = effectiveColor === 'transparent';

  const containerStyle: React.CSSProperties = {
      backgroundColor: bgUrl ? 'transparent' : (isTransparent ? 'transparent' : `${effectiveColor}20`),
      borderBottomColor: isTransparent ? 'transparent' : effectiveColor,
      borderBottomWidth: isTransparent ? '0px' : '2px',
      ...style,
  };
  
  // If a texture rect is defined, maintain its aspect ratio.
  if (rect && rect.width > 0 && rect.height > 0) {
      (containerStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
  }

  const inkStyle: React.CSSProperties = bgUrl ? {
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
      id={`header-${player.id}`}
      data-player-header-id={player.id}
      onClick={onClick}
      className={`relative flex-auto w-auto min-w-[3.375rem] p-2 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${isEditing ? 'z-20 ring-2 ring-inset ring-white/50' : ''} ${!bgUrl ? 'border-r border-b border-slate-700' : ''} ${className}`}
      style={containerStyle}
    >
      <SmartTextureLayer bgUrl={bgUrl} rect={rect} />
      
      <span className="text-sm font-bold whitespace-nowrap z-10" style={inkStyle}>
        {player.name}
      </span>
      
      {/* Shadow Overlay */}
      {bgUrl && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-0" />}
    </div>
  );
};

export default TexturedPlayerHeader;

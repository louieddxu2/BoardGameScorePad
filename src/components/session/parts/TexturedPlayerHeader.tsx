
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

// Simple Meeple Icon SVG Component with Stroke for visibility
const MeepleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path 
        d="M12 2C13.6569 2 15 3.34315 15 5C15 6.65685 13.6569 8 12 8C10.3431 8 9 6.65685 9 5C9 3.34315 10.3431 2 12 2ZM17.5 10C19.433 10 21 11.567 21 13.5V17C21 17.5523 20.5523 18 20 18H18.5V21C18.5 21.5523 18.0523 22 17.5 22H15.5C14.9477 22 14.5 21.5523 14.5 21V18H9.5V21C9.5 21.5523 9.05228 22 8.5 22H6.5C5.94772 22 5.5 21.5523 5.5 21V18H4C3.44772 18 3 17.5523 3 17V13.5C3 11.567 4.567 10 6.5 10H17.5Z" 
        fill="#ffffff" 
        stroke="#000000" 
        strokeWidth="1.5"
        strokeLinejoin="round"
    />
  </svg>
);

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
  const hasTexture = !!(baseImage && rect);

  const containerStyle: React.CSSProperties = {
      backgroundColor: bgUrl ? 'transparent' : (isTransparent ? 'transparent' : `${effectiveColor}20`),
      borderBottomColor: isTransparent ? 'transparent' : effectiveColor,
      borderBottomWidth: isTransparent ? '0px' : '2px',
      // [Fix]: When texture is present, remove min-height constraint to let aspect-ratio drive the height
      minHeight: hasTexture ? '0px' : undefined,
      ...style,
  };
  
  // [Change]: Removed aspect-ratio constraint.
  // This allows the player header to stretch horizontally (filling flex space)
  // without forcing a huge vertical height. The height will be determined by the 
  // sibling "Top Left Block" (TexturedBlock) which DOES maintain aspect ratio.

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
      // Relax min-width when using baseImage to prevent stretching
      className={`relative flex-auto w-auto ${baseImage ? 'min-w-0' : 'min-w-[3.375rem]'} flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${isEditing ? 'z-20 ring-2 ring-inset ring-white/50' : ''} ${!bgUrl ? 'border-r border-b border-slate-700' : ''} ${baseImage ? 'p-0' : 'p-2'} ${className}`}
      style={containerStyle}
    >
      <SmartTextureLayer bgUrl={bgUrl} rect={rect} />
      
      <span className="text-sm font-bold whitespace-nowrap z-10" style={inkStyle}>
        {player.name}
      </span>
      
      {/* Starting Player Icon - High Visibility Sticker Style */}
      {player.isStarter && (
        <div 
            className="absolute bottom-0.5 left-0.5 z-20 pointer-events-none drop-shadow-md filter"
            title="起始玩家"
        >
            <MeepleIcon className="w-5 h-5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
        </div>
      )}
      
      {/* Shadow Overlay */}
      {bgUrl && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-0" />}
    </div>
  );
};

export default TexturedPlayerHeader;


import React from 'react';

interface SmartTextureLayerProps {
  bgUrl: string | null;
  rect?: { width: number, height: number };
  opacity?: number;
}

const SmartTextureLayer: React.FC<SmartTextureLayerProps> = ({ bgUrl, opacity = 1 }) => {
  if (!bgUrl) return null;

  return (
    <div 
        className="absolute inset-0 w-full h-full pointer-events-none" 
        style={{ 
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: '100% 100%', // 強制填滿容器，隨容器大小自然縮放
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity 
        }}
    />
  );
};

export default SmartTextureLayer;

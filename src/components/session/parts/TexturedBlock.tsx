
import React, { useEffect, useState } from 'react';
import { Rect } from '../../../types';
import { cropImageToDataUrl } from '../../../utils/imageProcessing';

interface TexturedBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  baseImage?: string;
  rect?: Rect;
  /** Content to show ONLY when texture is NOT loaded (e.g. text label) */
  fallbackContent?: React.ReactNode;
  /** Content to show ALWAYS (e.g. overlays, indicators) */
  children?: React.ReactNode;
}

const TexturedBlock: React.FC<TexturedBlockProps> = ({ 
  baseImage, 
  rect, 
  fallbackContent, 
  children, 
  style, 
  className,
  ...rest 
}) => {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (baseImage && rect && rect.width > 0 && rect.height > 0) {
        cropImageToDataUrl(baseImage, rect).then(url => {
            if (isMounted) setBgUrl(url);
        });
    } else {
        setBgUrl(null);
    }
    return () => { isMounted = false; };
  }, [baseImage, rect]);

  const finalStyle: React.CSSProperties = { ...style };
  
  if (bgUrl) {
      finalStyle.backgroundImage = `url(${bgUrl})`;
      finalStyle.backgroundSize = '100% 100%';
      finalStyle.backgroundRepeat = 'no-repeat';
      finalStyle.border = 'none'; 
  }

  // Apply aspect ratio ONLY if we are in texture mode (baseImage is present)
  // This ensures that in standard mode (no image), the block sizes naturally based on content/padding
  if (baseImage && rect && rect.width > 0 && rect.height > 0) {
      (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
      // [Fix] When using aspect ratio, force minHeight to 0px to prevent default element height from stretching it vertically
      finalStyle.minHeight = '0px';
  }

  return (
    <div className={className} style={finalStyle} {...rest}>
      {children}
      {!bgUrl && fallbackContent}
    </div>
  );
};

export default TexturedBlock;

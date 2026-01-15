
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
            if (isMounted) setBgUrl(url || null);
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

  // [Robustness Fix] Only apply 0 minHeight if we ACTUALLY have a loaded background URL.
  // If cropping failed (bgUrl is null), we default to standard behavior (content dictates height),
  // preventing the row from collapsing to 0 height.
  if (bgUrl && rect && rect.width > 0 && rect.height > 0) {
      (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
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

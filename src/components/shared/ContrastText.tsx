import React from 'react';
import { getContrastTextStyles } from '../../utils/ui';
import type { AppTheme } from '../../theme';
import type { ColorReader } from '../../utils/color';

interface ContrastTextProps {
    children: React.ReactNode;
    color: string;
    className?: string;
    style?: React.CSSProperties;
    isTextureMode?: boolean;
    cleanOnLight?: boolean;
    theme?: AppTheme;
    background?: string;
    backdrop?: string;
    readColor?: ColorReader;
}

/**
 * A specialized component that ensures text remains readable on complex or high-contrast backgrounds.
 * Light UI labels can use clean, readable ink without changing the stored color.
 */
export const ContrastText: React.FC<ContrastTextProps> = ({
    children,
    color,
    className = '',
    style = {},
    isTextureMode = false,
    cleanOnLight = false,
    theme,
    background,
    backdrop,
    readColor,
}) => {
    const contrastStyles = getContrastTextStyles(color, theme, { isTextureMode, cleanOnLight, background, backdrop, read: readColor });

    return (
        <span 
            className={className} 
            style={{ 
                ...style, 
                color,
                ...contrastStyles,
            }}
        >
            {children}
        </span>
    );
};

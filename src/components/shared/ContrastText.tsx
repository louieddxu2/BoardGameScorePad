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
    theme?: AppTheme;
    background?: string;
    backdrop?: string;
    readColor?: ColorReader;
}

/**
 * A specialized component that ensures text remains readable on complex or high-contrast backgrounds.
 * Automatically applies appropriate shadows or outlines based on the theme and color luminance.
 */
export const ContrastText: React.FC<ContrastTextProps> = ({
    children,
    color,
    className = '',
    style = {},
    isTextureMode = false,
    theme,
    background,
    backdrop,
    readColor,
}) => {
    const contrastStyles = getContrastTextStyles(color, theme, { isTextureMode, background, backdrop, read: readColor });

    return (
        <span 
            className={className} 
            style={{ 
                ...style, 
                ...contrastStyles,
                color // Ensure the color is applied via style to override Tailwind classes if necessary
            }}
        >
            {children}
        </span>
    );
};

import React from 'react';
import { getContrastTextStyles } from '../../utils/ui';

interface ContrastTextProps {
    children: React.ReactNode;
    color: string;
    className?: string;
    style?: React.CSSProperties;
    isTextureMode?: boolean;
    theme?: 'dark' | 'light';
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
    theme
}) => {
    const contrastStyles = getContrastTextStyles(color, theme, { isTextureMode });

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

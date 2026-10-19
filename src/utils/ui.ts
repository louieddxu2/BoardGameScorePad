import { COLOR_TONES } from '../colors';
import { readColor } from './color';
import { getSolidTextChoice, relativeLuminance } from './colorContrast';

/**
 * Calculates the Euclidean distance between two touch points.
 * Used for pinch-to-zoom logic.
 */
export const getTouchDistance = (touches: { length: number; [index: number]: { clientX: number; clientY: number } }): number => {
  const [touch1, touch2] = [touches[0], touches[1]];
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
};

// --- Color Luminance Helpers ---

/**
 * Extracts the CSS variable name from a color string if present.
 * Example: "rgb(var(--c-p-black))" -> "--c-p-black"
 */
const extractVarName = (colorStr: string): string | null => {
    // Support player colors (--c-p-), text colors (--c-txt-), and status colors (--c-status-)
    const match = colorStr.match(/--(c-p|c-txt|c-status)-[a-z-]+/);
    return match ? match[0] : null;
};

/**
 * Calculates perceived luminance (0-255) using the standard luminosity formula.
 * Higher values = brighter color.
 */
export const getPerceivedLuminance = (hex: string): number => {
    const rgb = readColor(hex);
    if (!rgb) return 128; // Default to neutral (middle) if unparseable to avoid false positives
    // Standard relative luminance formula
    return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
};

/** Linear-sRGB luminance for choosing the higher-contrast black/white outline. */
export const getRelativeLuminance = (color: string): number => {
    const rgb = readColor(color);
    if (!rgb) return 0.5;
    return relativeLuminance(rgb);
};

/**
 * Determines if a color is dark enough to be perceived as "dark" on dark backgrounds.
 * Prioritizes COLOR_TONES registry for core palette, fallbacks to calculation.
 */
export const isColorDark = (hex: string): boolean => {
    if (!hex) return false;
    const varName = extractVarName(hex);
    if (varName && COLOR_TONES[varName]) {
        return COLOR_TONES[varName] === 'dark';
    }
    return getPerceivedLuminance(hex) < 115;
};

/**
 * Determines if a (text) color is light, requiring a dark shadow for contrast on light backgrounds.
 * Prioritizes COLOR_TONES registry for core palette, fallbacks to calculation.
 */
export const isColorLight = (hex: string): boolean => {
    if (!hex) return false;
    const varName = extractVarName(hex);
    if (varName && COLOR_TONES[varName]) {
        return COLOR_TONES[varName] === 'light';
    }
    return getPerceivedLuminance(hex) > 200;
};

/**
 * Compatibility wrapper for opaque backgrounds. Translucent paint needs an
 * explicit backing via getSolidTextChoice; ink-tone labels are a separate policy.
 */
export const isColorTooLight = (hex: string): boolean => {
    return !hex || getSolidTextChoice(hex) === 'dark';
};

// --- Theme-Aware Contrast System ---



/**
 * Reads the current theme from the DOM. Zero-cost since it's a simple attribute read.
 */
export const getCurrentTheme = (): 'dark' | 'light' => {
    if (typeof document === 'undefined') return 'dark';
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
};

/**
 * Returns a complete style object for high-contrast text rendering.
 * Implementation: Solution K (Precision Outline) using refined layered shadows.
 */
export const getContrastTextStyles = (
    textColorHex: string,
    theme?: 'dark' | 'light',
    options: { isTextureMode?: boolean } = {}
): React.CSSProperties => {
    if (!textColorHex) return {};
    const resolvedTheme = theme ?? getCurrentTheme();
    const { isTextureMode } = options;

    const styles: React.CSSProperties = {
        transition: 'color 0.3s, text-shadow 0.3s'
    };

    // --- Contrast Decision Logic ---
    const varName = extractVarName(textColorHex);
    const tone = varName ? COLOR_TONES[varName] : null;

    // --- Dark UI Environment (Dark Theme or Texture Mode) ---
    if (resolvedTheme === 'dark' || isTextureMode) {
        // High-Precision Outline for registered dark colors or calculated deep tones
        const shouldProtectDark = tone === 'dark' || (!tone && getPerceivedLuminance(textColorHex) < 60);

        if (shouldProtectDark) {
            return {
                ...styles,
                textShadow: `
                    1px 1px 0 rgba(255,255,255,0.7),
                    -1px 1px 0 rgba(255,255,255,0.7),
                    1px -1px 0 rgba(255,255,255,0.7),
                    -1px -1px 0 rgba(255,255,255,0.7),
                    0 1.5px 3px rgba(0,0,0,0.8)
                `
            };
        }
        // Standard colors: simple dark shadow for separation
        return {
            ...styles,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
        };
    }

    // --- Light UI Environment (Clean Mode) ---
    if (resolvedTheme === 'light') {
        // [Symmetric Protection] For light-toned text (e.g., White/Yellow) on White Background
        const isSystemText = varName?.includes('txt-primary') || varName?.includes('txt-secondary');
        const shouldProtectLight = !isSystemText && (tone === 'light' || (!tone && getPerceivedLuminance(textColorHex) > 170));

        if (shouldProtectLight) {
            // Apply Black Outline (The symmetric opposite of the dark mode white frame)
            return {
                ...styles,
                textShadow: `
                    1px 1px 0 rgba(0,0,0,0.6),
                    -1px 1px 0 rgba(0,0,0,0.6),
                    1px -1px 0 rgba(0,0,0,0.6),
                    -1px -1px 0 rgba(0,0,0,0.6)
                `
            };
        }

        // Standard dark text on light background: no heavy protection needed, maybe a tiny lift
        return {
            ...styles,
            textShadow: '0 0.5px 1px rgba(0,0,0,0.05)'
        };
    }

    return styles;
};

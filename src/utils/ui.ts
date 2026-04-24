import { COLOR_TONES } from '../colors';

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
 * Parses a hex or rgb/rgba color string to RGB components (0-255).
 * Supports CSS variables like rgb(var(--c-p-emerald)) by reading computed styles.
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    if (!hex) return null;

    // Handle rgb(var(--xyz)) or rgba(var(--xyz) / a)
    if (hex.includes('var(')) {
        // Extract the variable name
        const match = hex.match(/var\((--[a-zA-Z0-9-]+)\)/);
        if (match && match[1]) {
            const varName = match[1];
            // Get computed style
            if (typeof document !== 'undefined') {
                const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
                if (val) {
                    // val is expected to be space-separated numbers like "16 185 129"
                    const parts = val.split(/\s+/).map(Number);
                    if (parts.length >= 3) {
                        return { r: parts[0], g: parts[1], b: parts[2] };
                    }
                }
            }
        }
    }

    if (hex.startsWith('rgb')) {
        const match = hex.match(/\d+/g);
        if (match && match.length >= 3) {
            return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
        }
    }
    const clean = hex.replace('#', '');
    if (clean.length !== 6 && clean.length !== 3) return null;
    const full = clean.length === 3
        ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
        : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

/**
 * Extracts the CSS variable name from a color string if present.
 * Example: "rgb(var(--c-p-black))" -> "--c-p-black"
 */
const extractVarName = (colorStr: string): string | null => {
    const match = colorStr.match(/--c-p-[a-z-]+/);
    return match ? match[0] : null;
};

/**
 * Calculates perceived luminance (0-255) using the standard luminosity formula.
 * Higher values = brighter color.
 */
export const getPerceivedLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 255; // Default to bright if unparseable
    // Standard relative luminance formula
    return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
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
 * Determines if a background color is too light, requiring dark text for contrast.
 * Used for buttons (QuickButtonPad).
 */
export const isColorTooLight = (hex: string): boolean => {
    if (!hex) return true;
    const lowerHex = hex.toLowerCase();
    // Support common CSS variable themes and named colors
    if (lowerHex.includes('white') || lowerHex.includes('slate-50') || lowerHex.includes('slate-100') || lowerHex.includes('--c-white')) {
        return true;
    }
    const lum = getPerceivedLuminance(hex);
    return lum > 190; // Slightly lower threshold for safer dark text adoption
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
        const shouldProtect = tone === 'dark' || (!tone && getPerceivedLuminance(textColorHex) < 60);

        if (shouldProtect) {
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

    // --- Light UI Environment ---
    // Protection for light-toned text on light backgrounds
    const shouldProtectLight = tone === 'light' || (!tone && getPerceivedLuminance(textColorHex) > 170);

    if (resolvedTheme === 'light' && shouldProtectLight) {
        return {
            ...styles,
            textShadow: '0 1px 1px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)'
        };
    }

    return styles;
};
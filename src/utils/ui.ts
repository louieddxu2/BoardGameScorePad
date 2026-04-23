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
 * Calculates perceived luminance (0-255) using the standard luminosity formula.
 * Higher values = brighter color.
 */
const getPerceivedLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 128; // Default to mid-range (neutral)
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
};

/**
 * Determines if a (text) color is dark, requiring a light halo for contrast on dark backgrounds.
 * Threshold: luminance < 115 (Includes Black, Brown, Gray, Slate 900)
 */
export const isColorDark = (hex: string): boolean => {
    if (!hex) return false;
    return getPerceivedLuminance(hex) < 115;
};

/**
 * Determines if a (text) color is light, requiring a dark shadow for contrast on light backgrounds.
 * Threshold: luminance > 200 (e.g. #ffffff, #facc15, #fed7aa)
 */
export const isColorLight = (hex: string): boolean => {
    if (!hex) return false;
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

/** White halo for dark text on dark backgrounds. */
export const ENHANCED_TEXT_SHADOW = '0 0 2px rgba(255, 255, 255, 0.9), 0 0 4px rgba(255, 255, 255, 0.6), 0 0 8px rgba(255, 255, 255, 0.4)';

/** Dark shadow for light text on light backgrounds. */
export const DARK_TEXT_SHADOW = '0 0 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)';

/**
 * Reads the current theme from the DOM. Zero-cost since it's a simple attribute read.
 */
export const getCurrentTheme = (): 'dark' | 'light' => {
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
};

/**
 * Returns the appropriate text-shadow for a given text color in the current theme.
 * - Dark text on dark background → white halo
 * - Light text on light background → dark shadow
 * - Neutral (saturated) colors → no shadow needed (returns undefined)
 */
export const getContrastTextShadow = (textColorHex: string, theme?: 'dark' | 'light'): string | undefined => {
    if (!textColorHex) return undefined;
    const resolvedTheme = theme ?? getCurrentTheme();

    if (resolvedTheme === 'dark' && isColorDark(textColorHex)) {
        return ENHANCED_TEXT_SHADOW;
    }
    if (resolvedTheme === 'light' && isColorLight(textColorHex)) {
        return DARK_TEXT_SHADOW;
    }
    return undefined; // Neutral colors: no treatment needed
};
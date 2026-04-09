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
 * Parses a hex color string to RGB components (0-255).
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    if (!hex) return null;
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
 * Threshold: luminance < 80 (e.g. #1f2937, #a16207, #0f172a)
 */
export const isColorDark = (hex: string): boolean => {
    if (!hex) return false;
    return getPerceivedLuminance(hex) < 80;
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
export const ENHANCED_TEXT_SHADOW = '1px 0 1px rgba(var(--c-white) / 0.5), -1px 0 1px rgba(var(--c-white) / 0.5), 0 1px 1px rgba(var(--c-white) / 0.5), 0 -1px 1px rgba(var(--c-white) / 0.5)';

/** Dark shadow for light text on light backgrounds. */
export const DARK_TEXT_SHADOW = '1px 0 1px rgba(var(--c-black) / 0.3), -1px 0 1px rgba(var(--c-black) / 0.3), 0 1px 1px rgba(var(--c-black) / 0.3), 0 -1px 1px rgba(var(--c-black) / 0.3)';

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
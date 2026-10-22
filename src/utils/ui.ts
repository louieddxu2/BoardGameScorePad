import { COLOR_TONES } from '../colors';
import { readColor, type ColorReader, type RgbaColor } from './color';
import { getSolidTextChoice, relativeLuminance } from './colorContrast';
import { getThemeAppearance, resolveAppTheme, type AppTheme } from '../theme';

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
const perceivedLuminance = (rgb: RgbaColor): number => rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;

export const getPerceivedLuminance = (hex: string, read: ColorReader = readColor): number => {
    const rgb = read(hex);
    if (!rgb) return 128; // Default to neutral (middle) if unparseable to avoid false positives
    // Standard relative luminance formula
    return perceivedLuminance(rgb);
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
export const getCurrentTheme = (): AppTheme => {
    if (typeof document === 'undefined') return 'dark';
    return resolveAppTheme(document.documentElement.getAttribute('data-theme'));
};

/**
 * Returns a complete style object for high-contrast text rendering.
 * Preserve the supplied ink exactly; readability comes from outlines/shadows,
 * never from replacing a user-selected foreground color.
 */
export const getContrastTextStyles = (
    textColorHex: string,
    theme?: AppTheme,
    options: { isTextureMode?: boolean; background?: string; backdrop?: string; read?: ColorReader } = {}
): React.CSSProperties => {
    if (!textColorHex) return {};
    const resolvedTheme = getThemeAppearance(theme ?? getCurrentTheme());
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
        const shouldProtectDark = tone === 'dark' || (!tone && getPerceivedLuminance(textColorHex, options.read) < 60);

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
        // Custom ink stays normal-weight even when its container uses font-bold.
        // Semantic UI ink and texture rendering retain their existing typography.
        const isSystemInk = /var\(\s*--(?:c-(?!p-)|input-context-ink\b)/.test(textColorHex)
            || /^(?:inherit|initial|unset|currentcolor|transparent)$/i.test(textColorHex);
        if (!isSystemInk) styles.fontWeight = 400;

        // Honor the existing ink categories regardless of the supplied background.
        // Only unregistered colors use the original >170 brightness fallback.
        const ink = !tone ? (options.read ?? readColor)(textColorHex) : null;
        if (ink?.a === 0) return { ...styles, textShadow: 'none' };
        const isSystemText = varName?.includes('txt-primary') || varName?.includes('txt-secondary');
        const shouldProtectLight = !isSystemText && (tone === 'light' || (!!ink && perceivedLuminance(ink) > 170));

        if (shouldProtectLight) {
            // Thin black edge without increasing the selected text's font weight.
            return {
                ...styles,
                textShadow: '0.5px 0 0 rgba(0,0,0,0.6), -0.5px 0 0 rgba(0,0,0,0.6), 0 0.5px 0 rgba(0,0,0,0.6), 0 -0.5px 0 rgba(0,0,0,0.6)',
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

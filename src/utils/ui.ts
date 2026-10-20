import { COLOR_TONES } from '../colors';
import { createColorReader, readColor, type ColorReader } from './color';
import { compositeColors, contrastOnBackground, getSolidTextChoice, relativeLuminance } from './colorContrast';
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
export const getCurrentTheme = (): AppTheme => {
    if (typeof document === 'undefined') return 'dark';
    return resolveAppTheme(document.documentElement.getAttribute('data-theme'));
};

/**
 * Returns a complete style object for high-contrast text rendering.
 * Implementation: Solution K (Precision Outline) using refined layered shadows.
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
        // Known UI surfaces use actual contrast, not the palette's coarse tone labels.
        // A reader can be shared by a whole grid render; no element measurements.
        if (options.background) {
            const read = options.read ?? createColorReader();
            const ink = read(textColorHex);
            if (ink?.a === 0) return { ...styles, textShadow: 'none' };
            let background = read(options.background);
            if (background && background.a < 1 && options.backdrop) {
                const backing = read(options.backdrop);
                background = backing?.a === 1 ? compositeColors(background, backing) : null;
            }
            const ratio = ink && background ? contrastOnBackground(ink, background) : null;
            if (ink && ratio !== null) {
                if (ratio >= 4.5) return { ...styles, textShadow: 'none' };
                const width = ratio >= 3 ? 0.35 : ratio >= 2 ? 0.5 : 0.7;
                const alpha = ratio >= 3 ? 0.5 : ratio >= 2 ? 0.65 : 0.8;
                const edge = getSolidTextChoice(options.background, {
                    backdrop: options.backdrop, read,
                }) === 'light' ? 255 : 0;
                // Retain a trace of the selected hue instead of a harsh black/white rim.
                const channels = [ink.r, ink.g, ink.b].map(channel => Math.round(channel * 0.25 + edge * 0.75));
                const shadow = `rgba(${channels.join(',')},${alpha})`;
                return {
                    ...styles,
                    textShadow: `${width}px 0 0 ${shadow}, -${width}px 0 0 ${shadow}, 0 ${width}px 0 ${shadow}, 0 -${width}px 0 ${shadow}`,
                };
            }
        }
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

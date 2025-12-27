
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

/**
 * Determines if a background color is dark, requiring light text for contrast.
 */
export const isColorDark = (hex: string): boolean => {
    if (!hex) return false;
    const darkColors = ['#a16207', '#6b7280', '#1f2937', '#0f172a']; // Brown, Gray, Black, Slate 900
    return darkColors.includes(hex.toLowerCase());
};

/**
 * Enhanced text shadow for better readability on colored backgrounds.
 */
export const ENHANCED_TEXT_SHADOW = '1px 0 1px rgba(255,255,255,0.5), -1px 0 1px rgba(255,255,255,0.5), 0 1px 1px rgba(255,255,255,0.5), 0 -1px 1px rgba(255,255,255,0.5)';

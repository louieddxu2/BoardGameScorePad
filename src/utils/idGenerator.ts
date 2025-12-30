
/**
 * Generates a random ID.
 * If length is 36, it generates a standard UUID v4.
 * Otherwise, it generates a random alphanumeric string (Base62).
 */
export const generateId = (length: number = 36): string => {
  // Use standard UUID for length 36
  if (length === 36) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
      }
      // Simple fallback for UUID v4
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  }

  // Base62 for other lengths (e.g. 6 or 8 for short IDs)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  // crypto.getRandomValues is preferred over Math.random for better entropy,
  // though for this app's scale Math.random would technically suffice.
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    // Map the random byte to our character set
    result += chars[randomValues[i] % chars.length];
  }
  return result;
};


/**
 * Generates a random alphanumeric ID of a specified length.
 * Characters used: A-Z, a-z, 0-9 (Base62)
 */
export const generateId = (length: number = 12): string => {
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

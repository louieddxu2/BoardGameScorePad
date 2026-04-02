export function numberToTraditionalChinese(
  num: number, 
  digitChars: string,
  unitChars: string,
  negativeLabel: string
): string {
  if (num === 0) return digitChars[0];
  
  const digits = digitChars.split('');
  const units = ['', ...unitChars.split('')];
  
  let result = '';
  const str = Math.abs(num).toString();
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const n = parseInt(str[i]);
    const pos = len - i - 1;
    
    if (n !== 0) {
      if (len === 2 && i === 0 && n === 1) {
        result += units[pos];
      } else {
        result += digits[n] + units[pos];
      }
    } else {
      if (result.length > 0 && result[result.length - 1] !== digits[0] && pos !== 0) {
        if (str[i + 1] !== '0') {
           result += digits[0];
        }
      }
    }
  }

  return num < 0 ? negativeLabel + result : result;
}

/**
 * Replaces all Arabic numerals in a string with Chinese characters.
 */
export function replaceNumbersWithChinese(
  text: string,
  digitChars: string,
  unitChars: string,
  negativeLabel: string
): string {
  return text.replace(/\d+/g, (match) => {
    return numberToTraditionalChinese(parseInt(match), digitChars, unitChars, negativeLabel);
  });
}

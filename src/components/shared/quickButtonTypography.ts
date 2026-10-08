interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>;
}

// Keep the browser API optional without requiring a newer TypeScript lib or
// a runtime polyfill. Older browsers conservatively count Unicode code points.
const Segmenter = (Intl as typeof Intl & {
  Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
}).Segmenter;
const segmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : undefined;
const invisibleCharacters = /[\p{Mark}\p{Cf}]/gu;
const keycapEmoji = /^[#*0-9]\ufe0f?\u20e3$/;
const narrowAscii = /^[ilI.,:;'"!|]$/;
const wideAscii = /^[MWmw@#%&]$/;

// Integer twentieths of an em avoid rounding an exact capacity up to an extra
// line. These are conservative equivalent-width estimates, not font metrics.
const characterWidth = (grapheme: string): number => {
  if (keycapEmoji.test(grapheme)) return 20;
  const visible = grapheme.replace(invisibleCharacters, '');
  if (!visible) return 0; // Soft hyphens, zero-width controls and combining marks.
  const character = String.fromCodePoint(visible.codePointAt(0)!);
  const code = character.codePointAt(0)!;
  if (character === '\t') return 56; // pre-wrap's default eight spaces.
  if (character === ' ' || character === '\u00a0') return 7;
  if (code >= 0xff61 && code <= 0xff9f) return 10;

  const latinBase = code < 0x0250 ? character.normalize('NFD')[0] : character;
  if (wideAscii.test(latinBase)) return 20;
  if (narrowAscii.test(latinBase)) return 7;
  if (/^[A-Z]$/.test(latinBase)) return 16;
  if (/^[a-z0-9]$/.test(latinBase)) return 13;
  if (code < 0x80) return code < 0x20 ? 0 : 10;
  return 20; // CJK, full-width characters, emoji and other scripts.
};

const paragraphWidth = (paragraph: string): number => {
  let width = 0;
  if (segmenter) {
    for (const { segment } of segmenter.segment(paragraph)) width += characterWidth(segment);
  } else {
    // Even without grapheme segmentation, keycap digits must not be mistaken
    // for narrow ASCII. Other joined emoji may be conservatively overcounted.
    const fallback = paragraph.replace(/[#*0-9]\ufe0f?\u20e3/g, '⬛');
    for (const character of fallback) width += characterWidth(character);
  }
  return width;
};

export const getQuickButtonTypography = (label: string, columns: number, content: 'label' | 'number' = 'label') => {
  const lineCapacity = columns <= 1 ? 8 : columns === 2 ? 5 : columns === 3 ? 4 : 3;
  if (content === 'number') {
    // Monospace signs and decimal points occupy the same width as digits.
    // Budget the entire value on one line, not the label's wrap capacity.
    return { text: label, lineCapacity, widthUnits: Math.max(1, label.length) * 0.65, lineCount: 1 };
  }
  const capacityTicks = lineCapacity * 20;
  const text = label.replace(/\r\n?/g, '\n');
  const paragraphs = text.split('\n');
  // A final newline closes the preceding line. Only the last empty segment
  // is phantom in pre-wrap; leading and intermediate empty lines still count.
  const paragraphCount = paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === ''
    ? paragraphs.length - 1 : paragraphs.length;
  let longest = 0;
  let lineCount = 0;
  for (let index = 0; index < paragraphCount; index++) {
    const width = paragraphWidth(paragraphs[index]);
    longest = Math.max(longest, width);
    lineCount += Math.max(1, Math.ceil(width / capacityTicks));
  }
  return {
    text,
    lineCapacity,
    widthUnits: longest > 0 ? Math.min(longest, capacityTicks) / 20 : 1,
    lineCount,
  };
};

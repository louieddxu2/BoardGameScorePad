import { describe, expect, it, vi } from 'vitest';
import { getQuickButtonTypography } from './quickButtonTypography';

describe('quick-option label typography', () => {
  it.each([[1, 8], [2, 5], [3, 4], [4, 3]])('uses a %i-column line capacity of %i', (columns, capacity) => {
    expect(getQuickButtonTypography('一二三四五六七八九', columns).lineCapacity).toBe(capacity);
  });

  it.each([
    { columns: 2, text: '一二三四五', widthUnits: 5, lineCount: 1 },
    { columns: 2, text: '一二三四五六', widthUnits: 5, lineCount: 2 },
    { columns: 3, text: '一二三四', widthUnits: 4, lineCount: 1 },
    { columns: 3, text: '一二三四五', widthUnits: 4, lineCount: 2 },
    { columns: 4, text: '一二三', widthUnits: 3, lineCount: 1 },
    { columns: 4, text: '一二三四', widthUnits: 3, lineCount: 2 },
    { columns: 3, text: '山', widthUnits: 1, lineCount: 1 },
    { columns: 3, text: '森林', widthUnits: 2, lineCount: 1 },
    { columns: 3, text: '森林\n山谷', widthUnits: 2, lineCount: 2 },
    { columns: 3, text: '山\n一二三四五', widthUnits: 4, lineCount: 3 },
    { columns: 3, text: '\n森林', widthUnits: 2, lineCount: 2 },
    { columns: 3, text: '森林\n\n山谷', widthUnits: 2, lineCount: 3 },
    // A terminal newline closes the last line; it does not generate another
    // non-phantom line in the existing white-space: pre-wrap renderer.
    { columns: 3, text: '森林\n', widthUnits: 2, lineCount: 1 },
    { columns: 3, text: '森林\n\n', widthUnits: 2, lineCount: 2 },
    { columns: 3, text: '\n\n', widthUnits: 1, lineCount: 2 },
    { columns: 3, text: '', widthUnits: 1, lineCount: 1 },
    { columns: 3, text: 'Ａ１２', widthUnits: 3, lineCount: 1 },
    { columns: 3, text: '森林12', widthUnits: 3.3, lineCount: 1 },
    { columns: 3, text: '1111iiii', widthUnits: 4, lineCount: 1 },
    { columns: 3, text: '1111iiii山', widthUnits: 4, lineCount: 2 },
    { columns: 2, text: '11111iiiii', widthUnits: 5, lineCount: 1 },
    { columns: 3, text: ' 森林 ', widthUnits: 2.7, lineCount: 1 },
    { columns: 3, text: '\u200b\u00ad', widthUnits: 1, lineCount: 1 },
    { columns: 3, text: '1️⃣', widthUnits: 1, lineCount: 1 },
    { columns: 3, text: '#️⃣*️⃣', widthUnits: 2, lineCount: 1 },
    { columns: 3, text: 'WW', widthUnits: 2, lineCount: 1 },
    { columns: 3, text: '森林\u00ad山\u200b谷', widthUnits: 4, lineCount: 1 },
  ])('budgets $text separately at $columns columns', ({ columns, text, widthUnits, lineCount }) => {
    const typography = getQuickButtonTypography(text, columns);
    expect(typography.text).toBe(text);
    expect(typography.widthUnits).toBeCloseTo(widthUnits);
    expect(typography.lineCount).toBe(lineCount);
  });

  it.each(['森林\n\n山谷\n', '森林\r\n\r\n山谷\r\n', '森林\r\r山谷\r'])('normalizes line-ending forms without trimming %j', (text) => {
    expect(getQuickButtonTypography(text, 3)).toEqual({
      text: '森林\n\n山谷\n', lineCapacity: 4, widthUnits: 2, lineCount: 3,
    });
  });

  it('counts combining marks and emoji graphemes without UTF-16 overcounting', () => {
    expect(getQuickButtonTypography('é', 3).widthUnits).toBe(getQuickButtonTypography('e\u0301', 3).widthUnits);
    expect(getQuickButtonTypography('👨‍👩‍👧‍👦', 3).widthUnits).toBe(1);
    expect(getQuickButtonTypography('🇹🇼', 3).widthUnits).toBe(1);
  });

  it('does not let one long paragraph consume another paragraph\'s line remainder', () => {
    const withoutBreak = getQuickButtonTypography('一二三四五六七八九十', 3);
    const withBreak = getQuickButtonTypography('一二三四五\n六七八九十', 3);
    expect(withoutBreak.lineCount).toBe(3);
    expect(withBreak.text).toBe('一二三四五\n六七八九十');
    expect(withBreak.widthUnits).toBeCloseTo(4);
    expect(withBreak.lineCount).toBe(4);
  });

  it('keeps basic width and newline handling usable without Intl.Segmenter', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    try {
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
      vi.resetModules();
      const fallback = await import('./quickButtonTypography');
      expect(fallback.getQuickButtonTypography('森林12\r\n\r\n山谷', 3)).toEqual({
        text: '森林12\n\n山谷', lineCapacity: 4, widthUnits: 3.3, lineCount: 3,
      });
      expect(fallback.getQuickButtonTypography('é', 3).widthUnits).toBe(fallback.getQuickButtonTypography('e\u0301', 3).widthUnits);
      expect(fallback.getQuickButtonTypography('🎲', 3).widthUnits).toBe(1);
      expect(fallback.getQuickButtonTypography('1️⃣', 3).widthUnits).toBe(1);
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor);
      else Reflect.deleteProperty(Intl, 'Segmenter');
      vi.resetModules();
    }
  });
});

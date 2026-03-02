import { describe, expect, it } from 'vitest';
import {
  buildBuiltinHash,
  buildBuiltinShareUrl,
  buildCloudHash,
  parseDeepLinkFromHash,
  getEnglishSlug,
  toBuiltinShortId,
  toBuiltinFullId
} from './deepLink';

describe('deepLink — 最終網址架構', () => {
  describe('getEnglishSlug (雲端分享 Slug 規則)', () => {
    it('中文字元檢測：只要包含中文就回傳空字串', () => {
      expect(getEnglishSlug('農家樂')).toBe('');
      expect(getEnglishSlug('Agricola 農家樂')).toBe('');
      expect(getEnglishSlug('Agricola (農家樂)')).toBe('');
    });

    it('拉丁語系轉譯：無中文時處理變音符號', () => {
      expect(getEnglishSlug('Götterdämmerung')).toBe('gotterdammerung');
      expect(getEnglishSlug('Die Macher')).toBe('die-macher');
    });

    it('符號處理：將空格、冒號、分號轉為連字號', () => {
      expect(getEnglishSlug('A Feast for Odin: The Norwegians')).toBe('a-feast-for-odin-the-norwegians');
      expect(getEnglishSlug('Game; 123')).toBe('game-123');
    });
  });

  describe('Hash 生成 (Hash Generation)', () => {
    it('內建模板：直接映射 ID 並剝離前綴', () => {
      expect(buildBuiltinHash('Built-in-Agricola')).toBe('#Agricola');
    });

    it('內建模板：支援特殊字元編碼', () => {
      // 假設 ID 包含冒號或德文 (雖然使用者自行維護，但編碼確保安全)
      expect(buildBuiltinHash('Built-in-Game: Test')).toBe('#Game%3A%20Test');
    });

    it('內建模板：產生完整分享網址 (buildBuiltinShareUrl)', () => {
      // 由於 jsdom 模擬環境，這裡測試其格式拼接
      const link = buildBuiltinShareUrl('Built-in-Agricola');
      expect(link).toContain('/#Agricola');
      expect(link).toContain(window.location.origin);
    });

    it('雲端分享：具備 Slug 的語義化網址', () => {
      expect(buildCloudHash('abc1234567', 'Agricola')).toBe('#agricola/s/abc1234567');
    });

    it('雲端分享：包含中文時網址不帶 Slug', () => {
      expect(buildCloudHash('abc1234567', '農家樂')).toBe('#s/abc1234567');
    });
  });

  describe('解析邏輯 (parseDeepLinkFromHash)', () => {
    it('解析內建網址：支援普通路徑格式', () => {
      expect(parseDeepLinkFromHash('#Agricola')).toEqual({
        source: 'builtin',
        shortId: 'Agricola'
      });
    });

    it('解析內建網址：解碼編碼過的字元', () => {
      expect(parseDeepLinkFromHash('#Game%3A%20Test')).toEqual({
        source: 'builtin',
        shortId: 'Game: Test'
      });
    });

    it('解析雲端網址：支援 Slug 格式', () => {
      expect(parseDeepLinkFromHash('#agricola/s/abc1234567')).toEqual({
        source: 'cloud',
        cloudId: 'abc1234567'
      });
    });

    it('解析雲端網址：支援無 Slug 格式', () => {
      expect(parseDeepLinkFromHash('#s/abc1234567')).toEqual({
        source: 'cloud',
        cloudId: 'abc1234567'
      });
    });

    it('拒絕不合規或查詢參數格式 (為了過往遷移之乾淨)', () => {
      expect(parseDeepLinkFromHash('#v=1&src=builtin&id=Agricola')).toBeNull();
    });
  });

  describe('ID 轉換工具 (toBuiltinFullId / toBuiltinShortId)', () => {
    it('正確轉換全稱與簡稱', () => {
      expect(toBuiltinShortId('Built-in-Agricola')).toBe('Agricola');
      expect(toBuiltinFullId('Agricola')).toBe('Built-in-Agricola');
    });
  });
});

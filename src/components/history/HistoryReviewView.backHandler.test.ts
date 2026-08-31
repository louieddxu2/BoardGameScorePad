import { describe, expect, it } from 'vitest';
import historyReviewSource from './HistoryReviewView.tsx?raw';

describe('HistoryReviewView back-button handling', () => {
  it('registers the share menu in the modal history stack and uses its z-index', () => {
    expect(historyReviewSource).toMatch(
      /useModalBackHandler\(\s*showShareMenu,\s*\(\) => setShowShareMenu\(false\),\s*['"]history-share-menu['"]\s*\)/,
    );
    expect(historyReviewSource).toMatch(/<ShareMenu[\s\S]*?zIndex=\{shareMenuZIndex\}/);
  });
});

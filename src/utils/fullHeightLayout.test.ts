import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import appCss from '../index.css?raw';
import workspace from '../components/app/AppWorkspace.tsx?raw';
import sessionView from '../components/session/SessionView.tsx?raw';
import historyStats from '../components/dashboard/HistoryStatsPanel.tsx?raw';
import historyPhotoGrid from '../components/dashboard/HistoryPhotoGridShareModal.tsx?raw';
import historyReview from '../components/history/HistoryReviewView.tsx?raw';
import importStaging from '../features/bgstats/components/ImportStagingView.tsx?raw';
import bgStatsModal from '../features/bgstats/components/BgStatsModal.tsx?raw';
import bggImportModal from '../features/bgg/components/BggImportModal.tsx?raw';
import startPanel from '../features/game-selector/components/StartGamePanel.tsx?raw';

const returnedRootClasses = (source: string, name: string) => {
  const root = source.match(/return\s*\(\s*<div\b[^>]*\bclassName="([^"]+)"/);
  expect(root, `${name} returned root`).not.toBeNull();
  return root![1].split(/\s+/);
};

describe('full-height layout contracts', () => {
  it('establishes the explicit height chain before percentage-height descendants', async () => {
    const roots: postcss.Rule[] = [];
    postcss.parse(appCss).walkRules(rule => {
      if (['html', 'body', '#root'].every(selector => rule.selectors.includes(selector))) roots.push(rule);
    });
    expect(roots).toHaveLength(1);

    // Compile only the production root rule, without scanning template data.
    // Verify the actual 100% fallback and modern viewport declaration, not a
    // blacklist of historical child class strings. JSDOM cannot measure layout.
    const result = await postcss([tailwindcss({ content: [] })])
      .process(roots[0].toString(), { from: undefined });
    const heights: string[] = [];
    result.root.walkDecls('height', declaration => { heights.push(declaration.value); });
    expect(heights).toEqual(['100%', '100dvh']);
    expect(returnedRootClasses(workspace, 'AppWorkspace')).toEqual(
      expect.arrayContaining(['h-full', 'relative', 'overflow-hidden']),
    );
    expect(returnedRootClasses(sessionView, 'SessionView')).toEqual(
      expect.arrayContaining(['h-full', 'relative', 'overflow-hidden']),
    );
  });

  it('anchors app-owned bottom and full-screen workflows to the app surface', () => {
    expect(historyReview).toContain('className={`absolute left-0 right-0 z-40');
    expect(startPanel).toContain('className={`absolute z-40');
    expect(historyStats).toContain('className={`absolute z-40');
    expect(historyStats).toContain('className={`absolute right-2 top-1/2');
    expect(historyPhotoGrid).toContain('className="absolute inset-0');
    expect(bgStatsModal).toContain('className="absolute inset-0 z-[60] bg-app-bg');
    expect(bggImportModal).toContain('className="absolute inset-0 z-[60] bg-app-bg');
  });

  it('keeps full-screen photo and import actions inside iOS safe areas', () => {
    expect(historyPhotoGrid).toContain('safe-area-top-medium');
    expect(historyPhotoGrid).toContain('safe-area-bottom-medium');
    expect(historyPhotoGrid).toContain('max-h-[70dvh]');
    expect(importStaging).toContain('safe-area-top-medium');
    expect(importStaging).toContain('safe-area-bottom-medium');
  });
});

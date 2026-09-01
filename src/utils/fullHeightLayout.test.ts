import { describe, expect, it } from 'vitest';
import historyStats from '../components/dashboard/HistoryStatsPanel.tsx?raw';
import historyPhotoGrid from '../components/dashboard/HistoryPhotoGridShareModal.tsx?raw';
import historyReview from '../components/history/HistoryReviewView.tsx?raw';
import dataManager from '../components/dashboard/modals/DataManagerModal.tsx?raw';
import cloudLibrary from '../components/dashboard/modals/CloudLibraryModal.tsx?raw';
import cloudManager from '../components/dashboard/modals/CloudManagerModal.tsx?raw';
import inspectorShared from '../components/analysis/InspectorShared.tsx?raw';
import inspectorCommon from '../components/analysis/inspector/shared/InspectorCommon.tsx?raw';
import imageInspector from '../components/analysis/inspector/inspectors/ImageInspector.tsx?raw';
import scanPreview from '../components/scanner/ScanPreview.tsx?raw';
import screenshot from '../components/session/modals/ScreenshotModal.tsx?raw';
import autoPanel from '../components/session/parts/AutoScorePanel.tsx?raw';
import inputPanel from '../components/session/parts/InputPanel.tsx?raw';
import layout from '../components/session/parts/InputPanelLayout.tsx?raw';
import playerEditor from '../components/session/parts/PlayerEditor.tsx?raw';
import keypad from '../components/shared/NumericKeypad.tsx?raw';
import quickPad from '../components/shared/QuickButtonPad.tsx?raw';
import linkerList from '../features/bgstats/components/LinkerList.tsx?raw';
import importStaging from '../features/bgstats/components/ImportStagingView.tsx?raw';
import bgStatsModal from '../features/bgstats/components/BgStatsModal.tsx?raw';
import bggImportModal from '../features/bgg/components/BggImportModal.tsx?raw';
import gameList from '../features/game-selector/components/GameListView.tsx?raw';
import startPanel from '../features/game-selector/components/StartGamePanel.tsx?raw';

describe('full-height layout contracts', () => {
  it('keeps session input roots on explicit flex/grid sizing', () => {
    expect(layout).not.toContain('col-span-3 row-span-2 h-full');
    expect(layout).not.toContain('col-span-3 row-span-4 h-full');
    expect(keypad).not.toContain('grid grid-cols-3 grid-rows-4 gap-2 h-full');
    expect(quickPad).not.toContain('className="h-full overflow-y-auto');
    expect(quickPad).not.toContain('className="h-full flex items-center justify-center');
    expect(playerEditor).not.toContain('<div className="h-full" onClick=');
    expect(playerEditor).not.toContain('flex flex-col h-full p-2 gap-2');
    expect(playerEditor).toContain('className="flex flex-col flex-1 min-h-0" onClick=');
    expect(inputPanel).not.toContain('className="h-full flex items-center justify-center bg-surface-recessed');
    expect(autoPanel).not.toContain('flex flex-col h-full w-full');
  });

  it('does not combine flex remaining-space roots with h-full in bounded panels', () => {
    expect(dataManager).not.toContain('flex-1 p-4 overflow-hidden flex flex-col h-full');
    expect(dataManager).not.toContain('flex flex-col h-full gap-4');
    expect(dataManager).not.toContain('flex flex-col h-full gap-2');
    expect(scanPreview).not.toContain('flex-1 w-full h-full relative');
    expect(screenshot).not.toContain('flex-1 w-full h-full relative');
    expect(historyStats).not.toContain('transition-all duration-300 h-full');
    expect(linkerList).not.toContain('flex flex-col h-full min-w-0');
  });

  it('preserves game-selector height with flex self-stretch instead of percentages', () => {
    expect(startPanel).toContain("isAdvancedMode ? 'self-stretch' : ''");
    expect(startPanel).not.toContain("isAdvancedMode ? 'h-full' : ''");
    expect(gameList).toContain('self-stretch');
    expect(gameList).not.toContain('duration-300 h-full');
  });

  it('keeps empty, detail, and preview states inside flex or scroll bounds', () => {
    expect(historyStats).not.toContain('flex flex-col w-full h-full min-h-0');
    expect(historyStats).not.toContain('className="h-full flex flex-col items-center justify-center');
    expect(gameList).not.toContain('className="h-full flex flex-col items-center justify-center');
    expect(cloudLibrary).not.toContain('className="h-full flex flex-col items-center justify-center');
    expect(cloudManager).not.toContain('justify-between h-full gap-4');
    expect(cloudManager).not.toContain('justify-center h-full gap-3');
    expect(inspectorShared).not.toContain('className="h-full flex flex-col items-center justify-center');
    expect(inspectorCommon).not.toContain('className="h-full flex flex-col items-center justify-center');
    expect(imageInspector).not.toContain('gap-4 w-full h-full');
    expect(importStaging).not.toContain('flex flex-col h-full bg-app overflow-hidden');
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

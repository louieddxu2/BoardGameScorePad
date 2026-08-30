import { describe, expect, it } from 'vitest';
import historyStats from '../components/dashboard/HistoryStatsPanel.tsx?raw';
import dataManager from '../components/dashboard/modals/DataManagerModal.tsx?raw';
import scanPreview from '../components/scanner/ScanPreview.tsx?raw';
import screenshot from '../components/session/modals/ScreenshotModal.tsx?raw';
import autoPanel from '../components/session/parts/AutoScorePanel.tsx?raw';
import inputPanel from '../components/session/parts/InputPanel.tsx?raw';
import layout from '../components/session/parts/InputPanelLayout.tsx?raw';
import playerEditor from '../components/session/parts/PlayerEditor.tsx?raw';
import keypad from '../components/shared/NumericKeypad.tsx?raw';
import quickPad from '../components/shared/QuickButtonPad.tsx?raw';
import linkerList from '../features/bgstats/components/LinkerList.tsx?raw';
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
});

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { LanguageProvider } from '../../i18n';
import { HistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import HistoryStatsPanel from './HistoryStatsPanel';

vi.mock('../../hooks/useModalBackHandler', () => ({
  useModalBackHandler: vi.fn(() => ({ order: 0, zIndex: 0, triggerClose: vi.fn() }))
}));

vi.mock('./HistoryPhotoGridShareModal', () => ({
  default: () => null
}));

const record = (overrides: Partial<HistorySummary>): HistorySummary => ({
  id: overrides.id || 'h1',
  templateId: overrides.templateId || 'tpl-a',
  gameName: overrides.gameName || 'Game A',
  bggId: overrides.bggId,
  endTime: overrides.endTime || 1000,
  location: overrides.location,
  winnerIds: overrides.winnerIds || [],
  scoringRule: overrides.scoringRule,
  players: overrides.players || [],
  _playerNames: '',
  _dateStr: '',
  _compactDate: '',
  _rocDate: '',
  snapshotTemplate: undefined
});

describe('HistoryStatsPanel navigation', () => {
  beforeEach(() => {
    localStorage.setItem('app_language', 'zh-TW');
    vi.mocked(useModalBackHandler).mockClear();
  });

  it('returns to the overview tab that opened the detail flow', () => {
    const records = [
      record({
        id: 'a',
        gameName: 'Game A',
        endTime: 2000,
        players: [{ id: 'slot-a', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 10 }]
      }),
      record({
        id: 'b',
        gameName: 'Game B',
        endTime: 3000,
        players: [{ id: 'slot-b', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 8 }]
      })
    ];
    const savedPlayers = [{ id: 'p1', name: 'Alice' }];

    render(
      <LanguageProvider>
        <HistoryStatsPanel
          entries={buildHistoryGameEntries(records, { savedPlayers })}
          records={records}
          savedPlayers={savedPlayers}
          onSearchClick={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByTitle('切換至玩家總覽'));
    expect(screen.getByTitle('切換至遊戲總覽')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Game A'));
    fireEvent.click(screen.getByText('Game A'));

    expect(screen.getByTitle('切換至遊戲總覽')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('uses one detail back layer to return to the original overview', () => {
    const records = [
      record({
        gameName: 'Game A',
        players: [{ id: 'slot-a', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 10 }]
      })
    ];
    const savedPlayers = [{ id: 'p1', name: 'Alice' }];

    render(
      <LanguageProvider>
        <HistoryStatsPanel
          entries={buildHistoryGameEntries(records, { savedPlayers })}
          records={records}
          savedPlayers={savedPlayers}
          onSearchClick={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('Game A'));
    const detailRegistration = [...vi.mocked(useModalBackHandler).mock.calls]
      .reverse()
      .find(call => call[0] && call[2] === 'history-stats-detail');

    expect(detailRegistration).toBeDefined();
    act(() => detailRegistration?.[1]());

    expect(screen.getByTitle('切換至玩家總覽')).toBeInTheDocument();
  });
});

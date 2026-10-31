import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { LanguageProvider } from '../../i18n';
import { HistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import HistoryStatsPanel from './HistoryStatsPanel';
import type { HistoryPhotoRecapSnapshot } from '../../utils/historyPhotoRecapContext';

vi.mock('../../hooks/useModalBackHandler', () => ({
  useModalBackHandler: vi.fn(() => ({ order: 0, zIndex: 0, triggerClose: vi.fn() }))
}));

vi.mock('./HistoryPhotoGridShareModal', () => ({
  default: (props: {
    recap: HistoryPhotoRecapSnapshot | null;
    onClose: () => void;
  }) => props.recap ? (
    <div
      data-testid="photo-recap"
      data-selection-mode={props.recap.context.isSingleGame ? 'records' : 'games'}
      data-player-count={props.recap.playerCountOverride}
      data-date-label={props.recap.context.dateLabel}
      data-player-name={props.recap.playerName}
    >
      {props.recap.entries.map(entry => entry.displayName).join('、')}
      <button onClick={props.onClose}>Close recap</button>
    </div>
  ) : null
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
    expect(screen.getByText('Game B、Game A')).toBeInTheDocument();

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

  it('returns from a game detail when search removes the selected game', () => {
    const gameA = record({ id: 'a', gameName: 'Game A', endTime: 2000 });
    const gameB = record({ id: 'b', gameName: 'Game B', endTime: 3000 });

    const { rerender } = render(
      <LanguageProvider>
        <HistoryStatsPanel
          entries={buildHistoryGameEntries([gameA])}
          records={[gameA]}
          onSearchClick={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('Game A'));
    expect(screen.getByText('Game A')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <HistoryStatsPanel
          entries={buildHistoryGameEntries([gameB])}
          records={[gameB]}
          onSearchClick={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByTitle('切換至玩家總覽')).toBeInTheDocument();
    expect(screen.getByText('Game B')).toBeInTheDocument();
  });

  it('scopes photo recaps to the current detail page', () => {
    const records = [
      record({
        id: 'a',
        gameName: 'Game A',
        endTime: 2000,
        players: [
          { id: 'slot-a1', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 10 },
          { id: 'slot-a2', linkedPlayerId: 'p2', name: 'Bob', color: '#000', totalScore: 8 }
        ]
      }),
      record({
        id: 'b',
        gameName: 'Game B',
        endTime: 3000,
        players: [{ id: 'slot-b', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 8 }]
      })
    ];
    const savedPlayers = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ];

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
    fireEvent.click(screen.getByTitle('照片回顧'));

    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-selection-mode', 'records');
    expect(screen.getByTestId('photo-recap')).toHaveTextContent('Game A');
    expect(screen.getByTestId('photo-recap')).not.toHaveTextContent('Game B');
  });

  it('scopes player photo recaps to that player and counts unique companions', () => {
    const records = [
      record({
        id: 'a',
        gameName: 'Game A',
        endTime: 2000,
        players: [
          { id: 'slot-a1', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 10 },
          { id: 'slot-a2', linkedPlayerId: 'p2', name: 'Bob', color: '#000', totalScore: 8 }
        ]
      }),
      record({
        id: 'b',
        gameName: 'Game B',
        endTime: 3000,
        players: [{ id: 'slot-b', linkedPlayerId: 'p2', name: 'Bob', color: '#000', totalScore: 8 }]
      })
    ];
    const savedPlayers = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ];

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
    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByTitle('照片回顧'));

    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-selection-mode', 'records');
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-player-count', '1');
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-player-name', 'Alice');
    expect(screen.getByTestId('photo-recap')).toHaveTextContent('Game A');
    expect(screen.getByTestId('photo-recap')).not.toHaveTextContent('Game B');
  });

  it('freezes the searched records while open and refreshes dates and selection mode on reopening', () => {
    const original = [record({ id: 'first', gameName: 'Game A', endTime: new Date(2026, 10, 1, 9).getTime() })];
    const updated = [...original, record({ id: 'next', gameName: 'Game B', endTime: new Date(2026, 10, 2).getTime() })];
    const view = (records: HistorySummary[]) => (
      <LanguageProvider><HistoryStatsPanel entries={buildHistoryGameEntries(records)} records={records} onSearchClick={vi.fn()} /></LanguageProvider>
    );
    const { rerender } = render(view(original));
    fireEvent.click(screen.getByTitle('照片回顧'));
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-date-label', '2026.11.01');
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-selection-mode', 'records');

    rerender(view(updated));
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-date-label', '2026.11.01');
    expect(screen.getByTestId('photo-recap')).not.toHaveTextContent('Game B');

    fireEvent.click(screen.getByText('Close recap'));
    fireEvent.click(screen.getByTitle('照片回顧'));
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-date-label', '2026.11.01 — 11.02');
    expect(screen.getByTestId('photo-recap')).toHaveAttribute('data-selection-mode', 'games');
    expect(screen.getByTestId('photo-recap')).toHaveTextContent('Game B');
  });
});

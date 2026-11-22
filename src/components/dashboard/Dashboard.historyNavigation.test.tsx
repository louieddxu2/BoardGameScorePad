import 'fake-indexeddb/auto';
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { db } from '../../db';
import { LanguageProvider } from '../../i18n';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmationProvider } from '../../hooks/useConfirm';
import { useHistoryQuery } from '../../hooks/queries/useHistoryQuery';
import { useAppQueries } from '../../hooks/useAppQueries';
import { _resetActiveCountForTesting, getTopModalId, hasActiveModals, useModalBackHandler } from '../../hooks/useModalBackHandler';
import { AppView, type HistoryRecord } from '../../types';

// Cloud access and unrelated management dialogs are outside the navigation flow.
vi.mock('../../hooks/useGoogleDrive', () => ({ useGoogleDrive: () => ({ isConnected: false, isSyncing: false }) }));
vi.mock('./parts/DashboardModals', () => ({ DashboardModals: () => null }));

const noop = () => {};
const props: React.ComponentProps<typeof Dashboard> = {
  isVisible: true, currentView: AppView.DASHBOARD,
  userTemplates: [], shareableTemplateIds: new Set(), userTemplatesCount: 0,
  systemOverrides: {}, systemTemplates: [], systemTemplatesCount: 0,
  pinnedIds: [], newBadgeIds: [], activeSessionIds: [], activeSessions: [], recentlyPlayedGames: [],
  searchQuery: '', setSearchQuery: noop, themeMode: 'dark', onToggleTheme: noop, onSelectTheme: noop,
  zoomLevel: 1, onZoomChange: noop, onTemplateSelect: noop, onDirectResume: noop,
  onDiscardSession: noop, onClearAllActiveSessions: noop, getSessionPreview: () => null,
  onTemplateCreate: noop, onTemplateDelete: noop, onTemplateSave: noop, onBatchImport: noop,
  onTogglePin: noop, onTogglePinOption: noop, onClearNewBadges: noop, onRestoreSystem: noop,
  onGetFullTemplate: async () => null, onDeleteHistory: noop, onHistorySelect: noop,
  isInstalled: false, canInstall: false, onInstallClick: noop, onImportSession: noop, onImportHistory: noop,
  onBgStatsImport: async () => true, onGetLocalData: async () => ({}), gameOptions: [], onQuickStart: noop,
};
const record = (id: string, month: number): HistoryRecord => ({
  id, templateId: 'orchard', gameName: 'Orchard', startTime: 1,
  endTime: new Date(2026, month - 1, 2, 12).getTime(), players: [], winnerIds: [],
  snapshotTemplate: { id: 'orchard', name: 'Orchard', columns: [], createdAt: 1 },
});
const Review = ({ onClose }: { onClose: () => void }) => {
  useModalBackHandler(true, onClose, 'history-root');
  return <div role="dialog" aria-label="Record review" />;
};
const Harness = () => {
  const [query, setQuery] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const data = useHistoryQuery(query, undefined);
  return <>
    <output data-testid="matching-records">{data.historyRecords.map(row => row.id).join(',')}</output>
    <div hidden={reviewing}><Dashboard {...props} isVisible={!reviewing}
      currentView={reviewing ? AppView.HISTORY_REVIEW : AppView.DASHBOARD}
      searchQuery={query} setSearchQuery={setQuery}
      historyRecords={data.historyRecords} historyStatsRecords={data.historyStatsRecords}
      historyGameEntries={data.historyGameEntries} historyCount={data.historyCount}
      historyDateFilter={data.historyDateFilter} onHistoryDateFilterChange={data.setHistoryDateFilter}
      onHistorySelect={() => setReviewing(true)} /></div>
    {reviewing && <Review onClose={() => setReviewing(false)} />}
  </>;
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 2, 12));
  localStorage.setItem('app_language', 'en');
  _resetActiveCountForTesting();
  window.history.replaceState({ page: 'dashboard' }, '');
  await db.history.clear();
  await db.history.bulkPut([record('october', 10), record('november', 11)]);
});
afterEach(async () => {
  cleanup();
  await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
  _resetActiveCountForTesting();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const setup = async () => {
  render(<LanguageProvider><ToastProvider><ConfirmationProvider><Harness /></ConfirmationProvider></ToastProvider></LanguageProvider>);
  await waitFor(() => expect(screen.getByTestId('matching-records')).toHaveTextContent('november,october'));
  fireEvent.click(screen.getByTitle('History'));
};
const back = async (assertion: () => void) => {
  // Exercise the asynchronous History API after the shared hook's existing readiness guard.
  await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 310)); });
  act(() => window.history.back());
  await waitFor(assertion);
  await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
};
const selectMonth = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Filter dates:/ }));
  fireEvent.click(screen.getByRole('button', { name: 'This month' }));
};
const expectMonth = () => expect(screen.getByTestId('matching-records')).toHaveTextContent(/^november$/);
const expectAll = () => expect(screen.getByTestId('matching-records')).toHaveTextContent(/^november,october$/);
const openStats = () => fireEvent.click(screen.getByTitle('Stats'));

it('shows an ordered library from shared local queries, then loads history and the full catalog on demand', async () => {
  const pinnedIds = ['Built-in-EN-Startup'];
  await db.savedGames.put({ id: 'startup-recent', name: 'Recent game', bggId: '2', lastUsed: 2, usageCount: 1 });
  // Dexie announces the write to live queries on a later task; let that pass before counting reads,
  // or a busy test run can re-run the first saved-games query and count it twice.
  await new Promise(resolve => setTimeout(resolve, 0));
  const builtinReads = vi.spyOn(db.builtins, 'toArray');
  const savedGameReads = vi.spyOn(db.savedGames, 'orderBy');
  const historyReads = vi.spyOn(db.history, 'orderBy');
  const dictionaryReads = vi.spyOn(db.bggGames, 'toArray');
  const Harness = ({ isDbReady }: { isDbReady: boolean }) => {
    const [historyRequested, setHistoryRequested] = useState(false);
    const [gameOptionsRequested, setGameOptionsRequested] = useState(false);
    const data = useAppQueries('', pinnedIds, isDbReady, { historyRequested, gameOptionsRequested });
    return <Dashboard {...props} pinnedIds={pinnedIds} isLibraryLoading={data.isLibraryLoading}
      activeSessions={data.activeSessions} activeSessionIds={data.activeSessionIds}
      systemTemplates={data.systemTemplates} systemTemplatesCount={data.systemTemplatesCount}
      requestHistory={() => setHistoryRequested(true)} historyRecords={data.historyRecords}
      isHistoryLoading={!data.historyLoaded} historyCount={data.historyCount}
      requestGameOptions={() => setGameOptionsRequested(true)} gameOptions={data.gameOptions}
      isGameOptionsLoading={!data.gameOptionsLoaded}
      recentlyPlayedGames={data.recentlyPlayedGames} />;
  };
  const view = (isDbReady: boolean) => <LanguageProvider><ToastProvider><ConfirmationProvider>
    <Harness isDbReady={isDbReady} />
  </ConfirmationProvider></ToastProvider></LanguageProvider>;
  const { rerender, unmount } = render(view(false));
  const main = screen.getByRole('main');
  expect(main).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible();
  expect(screen.getByTitle('Start New')).toBeVisible();
  expect(within(main).queryByRole('heading')).not.toBeInTheDocument();

  try {
    await act(async () => {
      await db.builtins.put({ id: pinnedIds[0], name: 'Pinned board', bggId: '1', createdAt: 1, columns: [] });
      await db.sessions.put({ id: 'startup-session', templateId: 'another-board', name: 'Game in progress',
        status: 'active', startTime: 1, players: [] });
    });
    rerender(view(true));
    await within(main).findByRole('heading', { name: /Active Sessions/ });
    expect(main).not.toHaveAttribute('aria-busy');
    expect(within(main).getAllByRole('heading').slice(0, 3).map(heading => heading.textContent?.replace(/\s*\d+$/, '')))
      .toEqual(['Active Sessions', 'Quick Start', 'My Library']);
    expect(within(main).getByText('Recent game')).toBeVisible();
    expect(builtinReads).toHaveBeenCalledTimes(1);
    expect(savedGameReads).toHaveBeenCalledTimes(1);
    expect(historyReads).not.toHaveBeenCalled();
    expect(dictionaryReads).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('History'));
    expect(await within(main).findAllByText('Orchard')).toHaveLength(2);
    expect(historyReads).toHaveBeenCalledTimes(1);
    expect(dictionaryReads).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Library'));
    fireEvent.click(screen.getByTitle('Start New'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Scoring' })).toBeEnabled());
    expect(dictionaryReads).toHaveBeenCalledTimes(1);
    expect(builtinReads).toHaveBeenCalledTimes(1);
    expect(savedGameReads).toHaveBeenCalledTimes(1);
  } finally {
    unmount();
    await db.builtins.delete(pinnedIds[0]);
    await db.sessions.delete('startup-session');
    await db.savedGames.delete('startup-recent');
  }
});

it('keeps the selected date when closing statistics, then clears the list filter with one Back', async () => {
  await setup(); openStats(); selectMonth(); expectMonth();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  expectMonth();
  await back(expectAll);
  expect(screen.queryByRole('button', { name: 'Clear date filter' })).not.toBeInTheDocument();
  await waitFor(() => expect(hasActiveModals()).toBe(false));
  expect(window.history.state).toEqual({ page: 'dashboard' });
});

it('clears text and dates together and does not accumulate a layer for each date change', async () => {
  await setup(); openStats(); selectMonth();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  // Change the applied preset repeatedly from the visible filter control.
  selectMonth(); selectMonth();
  fireEvent.click(screen.getByRole('button', { name: /^Filter dates:/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Custom/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  // The existing header search icon has no accessible label.
  const search = within(screen.getByRole('banner')).getAllByRole('button').find(button => button.querySelector('svg.lucide-search'));
  expect(search).toBeDefined();
  fireEvent.click(search!);
  fireEvent.change(screen.getByPlaceholderText('Search history...'), { target: { value: 'Orchard' } });
  expectMonth();
  await back(expectAll);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await waitFor(() => expect(hasActiveModals()).toBe(false));
  expect(window.history.state).toEqual({ page: 'dashboard' });
});

it('prioritizes the custom dialog and statistics detail, preserving the applied date until the list returns', async () => {
  await setup(); openStats(); selectMonth();
  const statsGame = screen.getAllByRole('heading', { name: 'Orchard', level: 3 }).find(heading => !heading.closest('main'));
  expect(statsGame).toBeDefined();
  fireEvent.click(statsGame!);
  expect(getTopModalId()).toBe('history-stats-detail');
  await back(() => expect(getTopModalId()).toBe('history-stats-mode'));
  expectMonth();
  fireEvent.click(screen.getByRole('button', { name: /^Filter dates:/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Custom/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Year' }));
  await back(() => expect(screen.queryByRole('dialog', { name: 'Custom play dates' })).not.toBeInTheDocument());
  expectMonth();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  // Reopening statistics must retain the original query layer below the panel.
  openStats();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  expectMonth();
  await back(expectAll);
});

it('preserves the query across record review and leaves no extra Back layer when unfiltered statistics close', async () => {
  await setup(); openStats();
  await back(() => expect(screen.getByTitle('Stats')).toBeInTheDocument());
  await waitFor(() => expect(hasActiveModals()).toBe(false));
  expect(window.history.state).toEqual({ page: 'dashboard' });
  openStats(); selectMonth();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  fireEvent.click(screen.getByText('Orchard'));
  expect(screen.getByRole('dialog', { name: 'Record review' })).toBeInTheDocument();
  await back(() => expect(screen.queryByRole('dialog', { name: 'Record review' })).not.toBeInTheDocument());
  expectMonth();
  await back(expectAll);
});

it('preserves dates across library switches and removes the query layer when cleared with the visible button', async () => {
  await setup(); openStats(); selectMonth();
  await back(() => expect(screen.getByRole('button', { name: 'Clear date filter' })).toBeInTheDocument());
  fireEvent.click(screen.getByTitle('Library'));
  await waitFor(() => expect(hasActiveModals()).toBe(false));
  await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
  expect(window.history.state).toEqual({ page: 'dashboard' });
  fireEvent.click(screen.getByTitle('History'));
  expectMonth();
  fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));
  expectAll();
  await waitFor(() => expect(hasActiveModals()).toBe(false));
  await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
  expect(window.history.state).toEqual({ page: 'dashboard' });
});

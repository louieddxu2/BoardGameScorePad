import 'fake-indexeddb/auto';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db';
import { LanguageProvider } from '../../../i18n';
import { _resetActiveCountForTesting } from '../../../hooks/useModalBackHandler';
import GridFooter from '../../../components/session/parts/GridFooter';
import { useSessionRules } from '../hooks/useSessionRules';
import { toStoredGameEntry } from '../../official-boards/gameCatalog';
import type { GameRules } from '../types';

const RULES: GameRules = {
  gameId: 'game_civolution', slug: 'civolution', displayName: '文明演化', englishName: 'Civolution', ruleVersion: 'v1',
  rules: [
    { id: 'r1', statement: '建造船隻時不能從遠方拉部落上船', commonMistake: '玩成可以從遠方拉部落', details: '只能拉相鄰的部落',
      categories: ['action_effect_detail'], playerCounts: [], editionNotes: [], sourceLinks: [{ label: '英文規則書', url: 'https://example.com/rules' }],
      reviewStatus: 'reviewed', importanceCount: 1, tagIds: ['t-action'], createdAt: 1, updatedAt: 1 },
    { id: 'r2', statement: '回合結束時每個部落需要食物', commonMistake: '忽略船上的部落',
      categories: ['flow_endgame_scoring'], playerCounts: [3, 4], editionNotes: [], sourceLinks: [],
      reviewStatus: 'pending', importanceCount: 0, tagIds: ['t-round'], createdAt: 1, updatedAt: 1 },
  ],
  tags: [
    { id: 't-action', name: '行動', categoryHints: [], detectionKeywords: [] },
    { id: 't-round', name: '回合結束', categoryHints: [], detectionKeywords: [] },
  ],
  externalResources: [{ id: 'x1', name: '教學影片', category: 'teaching', url: 'https://example.com/video' }],
};

const mockCloud = (summaryCount: number) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === '/api/rules/summary') {
    return Response.json({ summary: summaryCount >= 0 ? { ruleGameId: RULES.gameId, publishedRuleCount: summaryCount, ruleVersion: 'v1' } : null });
  }
  return Response.json({ rules: RULES });
});

const Harness = ({ bggId }: { bggId?: string }) => {
  const { entry, drawer } = useSessionRules(bggId);
  return <>
    <div data-testid="entry">{entry}</div>
    {drawer}
  </>;
};
const renderSession = (bggId = '321') => render(<LanguageProvider><Harness bggId={bggId} /></LanguageProvider>);

beforeEach(async () => {
  localStorage.setItem('app_language', 'zh-TW');
  _resetActiveCountForTesting();
  await Promise.all([db.ruleSummaries.clear(), db.ruleContents.clear()]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('rules entry', () => {
  it('shows the rule count for a game with rules', async () => {
    mockCloud(2);
    renderSession();
    expect(await screen.findByRole('button', { name: '玩錯規則，2 條' })).toHaveTextContent('玩錯規則2');
  });

  it('stays hidden for a game with no rules, an unknown game, no BGG ID, or the English interface', async () => {
    const fetchSpy = mockCloud(0);
    renderSession('1');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    cleanup();

    const unknownGame = mockCloud(-1);
    renderSession('2');
    // The catalog is read first; the cloud is asked once it has no entry for this BGG ID.
    // (The fetch spy is shared with the case above, so wait for this ID's request itself.)
    await waitFor(() => expect(unknownGame.mock.calls.some(([input]) => String(input).includes('bggId=2'))).toBe(true));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    cleanup();

    vi.restoreAllMocks();
    const notAsked = mockCloud(2);
    render(<LanguageProvider><Harness /></LanguageProvider>);
    cleanup();
    localStorage.setItem('app_language', 'en');
    renderSession('3');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    expect(notAsked).not.toHaveBeenCalled();
  });
});

describe('rules entry from the local game catalog', () => {
  const putGames = () => db.gameCatalog.bulkPut([
    toStoredGameEntry({ bggId: '163068', name: 'Trickerion', boards: [],
      rules: [{ gameId: 'g-base', ruleGameId: 'g-base', publishedRuleCount: 19, ruleVersion: 'v1' }] }),
    toStoredGameEntry({ bggId: '244358', altNames: ['達爾加德學院'], boards: [], rules: [{ gameId: 'g-exp', ruleGameId: 'g-base' }] }),
    toStoredGameEntry({ bggId: '13', name: 'Catan', boards: [], rules: [{ gameId: 'g-catan', ruleGameId: null }] }),
  ]);
  afterEach(() => db.gameCatalog.clear());

  it('shows the count from the catalog, and an expansion its base game\'s count, without asking the cloud', async () => {
    await putGames();
    const fetchSpy = mockCloud(99);
    renderSession('244358');
    expect(await screen.findByRole('button', { name: '玩錯規則，19 條' })).toBeInTheDocument();
    cleanup();
    renderSession('163068');
    expect(await screen.findByRole('button', { name: '玩錯規則，19 條' })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes('/api/rules/summary'))).toEqual([]);
  });

  it('shows no entry for a catalog game without rules, also without asking the cloud', async () => {
    await putGames();
    const fetchSpy = mockCloud(5);
    renderSession('13');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks the cloud only for a BGG ID the catalog does not have yet', async () => {
    await putGames();
    const fetchSpy = mockCloud(2);
    renderSession('999');
    expect(await screen.findByRole('button', { name: '玩錯規則，2 條' })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual(['/api/rules/summary']);
  });
});

describe('rules drawer', () => {
  const openDrawer = async () => {
    mockCloud(2);
    renderSession();
    fireEvent.click(await screen.findByRole('button', { name: '玩錯規則，2 條' }));
    return screen.findByRole('dialog', { name: '玩錯的桌遊規則' });
  };

  it('lists the rules with their mistakes and opens the rules site from its two buttons', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const dialog = await openDrawer();
    expect(await within(dialog).findByText('建造船隻時不能從遠方拉部落上船')).toBeInTheDocument();
    expect(within(dialog).getByText('玩成可以從遠方拉部落')).toBeInTheDocument();
    expect(within(dialog).getByText('未審核')).toBeInTheDocument();
    expect(within(dialog).getByText('教學影片')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '到玩錯的桌遊規則記錄這款遊戲的規則' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '到玩錯的桌遊規則查看這款遊戲' }));
    expect(opened.mock.calls.map((call) => call[0])).toEqual([
      'https://board-game-helper.louieddxu2.workers.dev/add?game=civolution',
      'https://board-game-helper.louieddxu2.workers.dev/games/civolution',
    ]);
  });

  it('filters by category, tag and keyword with the shared rule filter, and expands details', async () => {
    const dialog = await openDrawer();
    await within(dialog).findByText('建造船隻時不能從遠方拉部落上船');

    fireEvent.click(within(dialog).getByRole('button', { name: '流程、終局、計分' }));
    expect(within(dialog).queryByText('建造船隻時不能從遠方拉部落上船')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '流程、終局、計分' }));

    fireEvent.click(within(dialog).getByRole('button', { name: '#行動' }));
    expect(within(dialog).queryByText('回合結束時每個部落需要食物')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '清除篩選' }));
    expect(within(dialog).getByText('回合結束時每個部落需要食物')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText('輸入關鍵字搜尋'), { target: { value: '食物' } });
    expect(within(dialog).queryByText('建造船隻時不能從遠方拉部落上船')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText('輸入關鍵字搜尋'), { target: { value: '' } });

    expect(within(dialog).queryByText('只能拉相鄰的部落')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /^展開規則：建造船隻/ }));
    expect(within(dialog).getByText('只能拉相鄰的部落')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '英文規則書' })).toHaveAttribute('href', 'https://example.com/rules');
  });

  it('closes from the strip on the left and from a swipe to the right, but not from a short or vertical drag', async () => {
    let dialog = await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '玩錯規則，2 條' }));
    dialog = await screen.findByRole('dialog', { name: '玩錯的桌遊規則' });
    const swipe = (dx: number, dy: number) => {
      fireEvent.touchStart(dialog, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(dialog, { touches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
      fireEvent.touchEnd(dialog);
    };
    swipe(40, 0);
    swipe(20, 200);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    swipe(120, 10);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('grid footer', () => {
  it('shows its row for the rules entry even on a short board without the toolbox button', () => {
    const props = { isEditMode: false, onAddColumn: () => {}, itemColStyle: {}, showToolboxButton: false, isToolboxOpen: false, onToggleToolbox: () => {} };
    const { rerender, container } = render(<LanguageProvider><GridFooter {...props} /></LanguageProvider>);
    expect(container).toBeEmptyDOMElement();
    rerender(<LanguageProvider><GridFooter {...props} middleEnd={<button type="button">rules</button>} /></LanguageProvider>);
    expect(screen.getByRole('button', { name: 'rules' })).toBeInTheDocument();
  });
});

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

/** The cloud as the drawer sees it: only the rules themselves are ever fetched. */
const mockCloud = () => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ rules: RULES }));

/** The local game catalog: a base game with rules, its expansion, a game without rules. */
const putGames = () => db.gameCatalog.bulkPut([
  toStoredGameEntry({ bggId: '321', name: 'Civolution', boards: [],
    rules: [{ gameId: RULES.gameId, ruleGameId: RULES.gameId, publishedRuleCount: 2, ruleVersion: 'v1' }] }),
  toStoredGameEntry({ bggId: '322', altNames: ['文明演化擴充'], boards: [], rules: [{ gameId: 'g-exp', ruleGameId: RULES.gameId }] }),
  toStoredGameEntry({ bggId: '13', name: 'Catan', boards: [], rules: [{ gameId: 'g-catan', ruleGameId: null }] }),
  toStoredGameEntry({ bggId: '14', name: 'Zero', boards: [], rules: [{ gameId: 'g-zero', ruleGameId: 'g-zero', publishedRuleCount: 0, ruleVersion: 'v0' }] }),
]);

const Harness = ({ bggId }: { bggId?: string }) => {
  const { entry, drawer } = useSessionRules(bggId);
  return <>
    <div data-testid="entry">{entry}</div>
    {drawer}
  </>;
};
const renderSession = (bggId = '321') => render(<LanguageProvider><Harness bggId={bggId} /></LanguageProvider>);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

beforeEach(async () => {
  localStorage.setItem('app_language', 'zh-TW');
  _resetActiveCountForTesting();
  await Promise.all([db.ruleSummaries.clear(), db.ruleContents.clear(), db.gameCatalog.clear()]);
  await putGames();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('rules entry from the local game catalog', () => {
  it('shows the count from the catalog, and an expansion its base game\'s count, without any request', async () => {
    const fetchSpy = mockCloud();
    renderSession('321');
    expect(await screen.findByRole('button', { name: '玩錯規則，2 條' })).toHaveTextContent('玩錯規則2');
    cleanup();
    renderSession('322');
    expect(await screen.findByRole('button', { name: '玩錯規則，2 條' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stays hidden, without any request, for no rules, zero rules, an unknown game, no BGG ID, or English', async () => {
    const fetchSpy = mockCloud();
    for (const bggId of ['13', '14', '999']) {
      renderSession(bggId);
      await settle();
      expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
      cleanup();
    }
    render(<LanguageProvider><Harness /></LanguageProvider>);
    await settle();
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    cleanup();
    localStorage.setItem('app_language', 'en');
    renderSession('321');
    await settle();
    expect(screen.getByTestId('entry')).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
describe('rules drawer', () => {
  const openDrawer = async () => {
    mockCloud();
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
    // A swipe on the tag row scrolls the tags and never closes the drawer.
    const tags = await within(dialog).findByRole('button', { name: '#行動' });
    fireEvent.touchStart(tags, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(tags, { touches: [{ clientX: 260, clientY: 100 }] });
    fireEvent.touchEnd(tags);
    await settle();
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

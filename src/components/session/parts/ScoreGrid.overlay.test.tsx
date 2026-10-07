import React, { createRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { GameSession, GameTemplate } from '../../../types';
import ScoreGrid from './ScoreGrid';

const session: GameSession = {
  id: 'overlay-session', templateId: 'overlay-template', name: 'Overlay', startTime: 1, status: 'active',
  players: [
    { id: 'p1', name: 'Alice', color: '#ff0000', totalScore: 1,
      scores: { points: { parts: [1] }, choice: { parts: [2], optionId: 'a' } } },
    { id: 'p2', name: 'Bob', color: '#0000ff', totalScore: 3,
      scores: { points: { parts: [3] }, choice: { parts: [5], optionId: 'b' } } }
  ]
};
const setup = (isShared: boolean) => {
  const template: GameTemplate = { id: session.templateId, name: 'Overlay', createdAt: 1, columns: [
    { id: 'points', name: 'Points', inputType: 'keypad', formula: 'a1', isScoring: true, isShared },
    { id: 'choice', name: 'Choice', inputType: 'clicker', formula: 'a1', isScoring: true, displayMode: 'overlay',
      contentLayout: { x: 10, y: 20, width: 30, height: 40 },
      quickActions: [{ id: 'a', label: 'A', value: 2 }, { id: 'b', label: 'B', value: 5 }] }
  ] };
  const activate = vi.fn();
  const parentClick = vi.fn();
  const scrollRef = createRef<HTMLDivElement>();
  const contentRef = createRef<HTMLDivElement>();
  const tree = (current: GameSession) => <LanguageProvider><div ref={scrollRef} onClick={parentClick}>
    <ScoreGrid session={current} template={template} editingCell={{ playerId: 'p2', colId: 'choice' }}
      editingPlayerId={null} onCellClick={activate} onPlayerHeaderClick={vi.fn()}
      onColumnHeaderClick={vi.fn()} onUpdateTemplate={vi.fn()} onAddColumn={vi.fn()}
      scrollContainerRef={scrollRef} contentRef={contentRef} isEditMode={false} zoomLevel={1} panelDockOffset="0px" />
  </div></LanguageProvider>;
  const view = render(tree(session));
  const target = (label: string) => view.getByText(label).closest('.pointer-events-auto') as HTMLElement;
  return { ...view, activate, parentClick, tree, target };
};

describe('score grid overlay ownership', () => {
  afterEach(cleanup);

  it('keeps individual overlays scoped to their player and retains the keyed target after a score update', () => {
    const view = setup(false);
    const first = view.target('A');
    const second = view.target('B');
    expect(first).not.toHaveClass('border-brand-primary');
    expect(second).toHaveClass('border-brand-primary');
    expect(first.style.left).toBe('10%');
    fireEvent.click(first);
    fireEvent.click(second);
    expect(view.activate.mock.calls.map(call => call.slice(0, 2))).toEqual([['p1', 'choice'], ['p2', 'choice']]);
    expect(view.parentClick).not.toHaveBeenCalled();

    view.rerender(view.tree({ ...session, players: session.players.map(player => player.id === 'p1' ? {
      ...player, scores: { ...player.scores, choice: { parts: [5], optionId: 'b' } }
    } : player) }));
    expect(view.container.querySelector('.player-col-p1 .pointer-events-auto')).toBe(first);
    expect(first).toHaveTextContent('B');
  });

  it('uses the first player for shared overlays but highlights the active column regardless of player ID', () => {
    const view = setup(true);
    const target = view.target('A');
    expect(view.queryByText('B')).toBeNull();
    expect(view.container.querySelectorAll('.shared-col-container .pointer-events-auto')).toHaveLength(1);
    expect(target).toHaveClass('border-brand-primary');
    fireEvent.click(target);
    expect(view.activate.mock.calls.map(call => call.slice(0, 2))).toEqual([['p1', 'choice']]);
    expect(view.parentClick).not.toHaveBeenCalled();
  });
});

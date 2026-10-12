import React, { useMemo } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import type { ScoreColumn } from '../../types';
import QuickButtonPad from './QuickButtonPad';

const actions = Array.from({ length: 7 }, (_, index) => ({
  id: String(index), label: `Option ${index}`, value: index,
}));
const onAction = vi.fn();
const PadHarness = ({ columnId = 'a', playerId = 'p1', open = true, sessionId = 'session',
  currentOptionId, currentMultiOptionIds }: {
  columnId?: string; playerId?: string; open?: boolean; sessionId?: string;
  currentOptionId?: string; currentMultiOptionIds?: string[];
}) => {
  const positions = useMemo(() => new Map<string, number>(), [sessionId]);
  const column: ScoreColumn = {
    id: columnId, name: 'List', inputType: 'clicker', formula: 'a1', isScoring: true, quickActions: actions,
  };
  return <LanguageProvider><div data-player={playerId}>{open && <QuickButtonPad
    column={column} onAction={onAction} scrollPositions={positions}
    currentOptionId={currentOptionId} currentMultiOptionIds={currentMultiOptionIds}
  />}</div></LanguageProvider>;
};

const container = () => screen.getAllByRole('button')[0].closest<HTMLElement>('.overflow-y-auto')!;
const scrollTo = (top: number) => {
  container().scrollTop = top;
  fireEvent.scroll(container());
};

describe('quick-button scroll context', () => {
  beforeEach(() => {
    onAction.mockClear();
    // JSDOM has no layout. Only model the existing scroll viewport and rows,
    // keeping real component rendering, selection and input handlers intact.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const viewport = this.closest<HTMLElement>('.overflow-y-auto');
      if (this.tagName === 'BUTTON' && viewport) {
        const index = Array.from(viewport.querySelectorAll('button')).indexOf(this as HTMLButtonElement);
        return new DOMRect(0, 8 + index * 60 - viewport.scrollTop, 200, 56);
      }
      return new DOMRect(0, 0, 200, 100);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('restores by column, but never jumps on a player change, selection or rapid click', () => {
    const { rerender } = render(<PadHarness />);
    scrollTo(120);
    rerender(<PadHarness columnId="b" />);
    expect(container().scrollTop).toBe(0);
    scrollTo(240);
    rerender(<PadHarness />);
    expect(container().scrollTop).toBe(120);
    rerender(<PadHarness playerId="p2" currentOptionId="6" />);
    expect(container().scrollTop).toBe(120);
    fireEvent.click(screen.getByRole('button', {
      name: name => /^Option 3\s*3$/.test(name.replace(/\u00ad/g, '')),
    }));
    expect(onAction).toHaveBeenCalledOnce();
    rerender(<PadHarness playerId="p2" currentOptionId="3" />);
    expect(container().scrollTop).toBe(120);
    rerender(<PadHarness columnId="b" />);
    expect(container().scrollTop).toBe(240);
    rerender(<PadHarness columnId="b" sessionId="another-session" />);
    expect(container().scrollTop).toBe(0);
  });

  it('keeps memory across closing and reveals a hidden filled option only on reopening', () => {
    const { rerender } = render(<PadHarness />);
    scrollTo(120);
    rerender(<PadHarness open={false} />);
    rerender(<PadHarness />);
    expect(container().scrollTop).toBe(120);
    rerender(<PadHarness open={false} />);
    rerender(<PadHarness currentOptionId="5" />);
    // Option 5 ends at content y=364; reveal it with the existing 8px padding.
    expect(container().scrollTop).toBe(272);
    rerender(<PadHarness open={false} />);
    rerender(<PadHarness currentMultiOptionIds={['0', '5']} />);
    // One selected item is already visible: don't jump to the other one.
    expect(container().scrollTop).toBe(272);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('clamps a remembered height when the available content becomes shorter', () => {
    const { rerender } = render(<PadHarness />);
    scrollTo(560);
    rerender(<PadHarness open={false} />);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(180);
    rerender(<PadHarness />);
    expect(container().scrollTop).toBe(80);
  });
});

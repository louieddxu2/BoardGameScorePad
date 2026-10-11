import React, { createRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { GameSession, GameTemplate } from '../../../types';
import ScoreGrid from './ScoreGrid';

afterEach(cleanup);

const session: GameSession = {
  id: 'scroll-session', templateId: 'scroll-template', name: 'Scroll', startTime: 1, status: 'active',
  players: Array.from({ length: 8 }, (_, index) => ({
    id: `p${index}`, name: `Player ${index}`, color: '#ff0000', scores: {}, totalScore: 0,
  })),
};

describe('score grid native scrolling surface', () => {
  it.each([false, true])('keeps horizontal panning on the full viewport when the board is empty=%s', empty => {
    const template: GameTemplate = { id: session.templateId, name: 'Scroll', createdAt: 1, columns: empty ? [] : [
      { id: 'points', name: 'Points', inputType: 'keypad', formula: 'a1', isScoring: true },
    ] };
    const viewportRef = createRef<HTMLDivElement>();
    const contentRef = createRef<HTMLDivElement>();
    const onCellClick = vi.fn();
    const onUpdateTemplate = vi.fn();
    render(<LanguageProvider><ScoreGrid
      session={session} template={template} editingCell={null} editingPlayerId={null}
      onCellClick={onCellClick} onPlayerHeaderClick={vi.fn()} onColumnHeaderClick={vi.fn()}
      onUpdateTemplate={onUpdateTemplate} onAddColumn={vi.fn()}
      scrollContainerRef={viewportRef} contentRef={contentRef} isEditMode={false}
      zoomLevel={1} panelDockOffset="0px" />
    </LanguageProvider>);

    const viewport = viewportRef.current!;
    // JSDOM does not implement touch-driven scrolling. Check the actual
    // scroll owner's CSS contract instead of simulating a new swipe handler.
    expect(viewport).toHaveClass('absolute', 'inset-0', 'touch-pan-x', 'touch-pan-y');
    expect(contentRef.current!.parentElement).toBe(viewport);
    if (empty) {
      expect(viewport).toHaveClass('overflow-x-auto', 'overflow-y-hidden', 'h-full', 'pb-0');
      expect(viewport).not.toHaveClass('overflow-hidden');
    } else {
      expect(viewport).toHaveClass('overflow-auto', 'pb-32');
    }

    const finger = { identifier: 1, clientX: 300, clientY: 400 };
    expect(fireEvent.touchStart(viewport, { touches: [finger] })).toBe(true);
    expect(fireEvent.touchMove(viewport, { touches: [{ ...finger, clientX: 80 }] })).toBe(true);
    expect(fireEvent.touchEnd(viewport, { touches: [], changedTouches: [finger] })).toBe(true);
    expect(onCellClick).not.toHaveBeenCalled();
    expect(onUpdateTemplate).not.toHaveBeenCalled();
  });
});

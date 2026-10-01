import React, { useEffect, useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import TotalsBar from './TotalsBar';

const Harness = ({ total, reset }: { total: () => void; reset: () => void }) => {
  useMobileZoom();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.addEventListener('click', suppressInvalidTouchClick, true);
    return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
  }, []);
  return <LanguageProvider><div>
    <TotalsBar players={[{ id: 'p1', name: 'P1', color: '#112233', scores: {}, totalScore: 0 }]}
      winners={[]} isPanelOpen={false} panelHeight="0px" scrollRef={scrollRef} contentRef={contentRef}
      onTotalClick={total} onReset={reset} />
    <div data-testid="other" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} />
  </div></LanguageProvider>;
};

afterEach(cleanup);

const makeTotals = (kind: 'total' | 'reset') => {
  const total = vi.fn();
  const reset = vi.fn();
  render(<Harness total={total} reset={reset} />);
  const target = kind === 'reset' ? screen.getByRole('button', { name: 'Reset' })
    : document.querySelector('#live-totals-bar .player-col-p1') as HTMLElement;
  return { total, reset, target, other: screen.getByTestId('other') };
};

describe('actual totals row touch activation', () => {
  it.each(['total', 'reset'] as const)('does not activate %s on either pinch-release order or on unannotated clicks', (kind) => {
    const { total, reset, target, other } = makeTotals(kind);
    const first = { identifier: 1, clientX: 100, clientY: 100 };
    const second = { identifier: 2, clientX: 200, clientY: 100 };
    // The second surface stops bubbling: the App owner must see it in capture.
    fireEvent.touchStart(target, { touches: [first], changedTouches: [first] });
    fireEvent.touchStart(other, { touches: [first, second], changedTouches: [second] });
    fireEvent.touchEnd(other, { touches: [first], changedTouches: [second] });
    fireEvent.touchEnd(target, { touches: [], changedTouches: [first] });
    fireEvent.click(target, { detail: 0 });
    fireEvent.click(target, { detail: 1 });
    expect(total).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();

    fireEvent.touchStart(target, { touches: [first], changedTouches: [first] });
    fireEvent.touchStart(other, { touches: [first, second], changedTouches: [second] });
    fireEvent.touchEnd(target, { touches: [second], changedTouches: [first] });
    fireEvent.touchEnd(other, { touches: [], changedTouches: [second] });
    expect(total).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it.each(['total', 'reset'] as const)('keeps rapid %s taps synchronous and avoids duplicate compatibility clicks', (kind) => {
    const { total, reset, target } = makeTotals(kind);
    const action = kind === 'total' ? total : reset;
    for (let index = 1; index <= 20; index++) {
      const touch = { identifier: index, clientX: 100, clientY: 100 };
      fireEvent.touchStart(target, { touches: [touch], changedTouches: [touch] });
      fireEvent.touchEnd(target, { touches: [], changedTouches: [touch] });
      expect(action).toHaveBeenCalledTimes(index);
      fireEvent.click(target, { detail: 1 });
      expect(action).toHaveBeenCalledTimes(index);
    }
  });
});

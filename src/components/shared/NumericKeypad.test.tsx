import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NumericKeypad from './NumericKeypad';

const makeProps = () => ({
  value: 0,
  onChange: vi.fn(),
  onNext: vi.fn(),
  column: {
    id: 'score',
    name: 'Score',
    formula: 'a1',
    inputType: 'keypad' as const,
    isScoring: true,
    rounding: 'none' as const,
  },
  overwrite: true,
  setOverwrite: vi.fn(),
  activeFactorIdx: 0 as const,
  setActiveFactorIdx: vi.fn(),
  playerId: 'p1',
});

describe('NumericKeypad', () => {
  it('allows the keypad grid and buttons to shrink within a height-constrained panel', () => {
    render(<NumericKeypad {...makeProps()} />);

    const button = screen.getByRole('button', { name: '1' });
    const grid = button.closest('.grid-cols-3');

    expect(grid).toHaveClass('min-h-0');
    expect(button).toHaveClass('min-h-0');
  });

  it('keeps the existing click behavior for a normal button activation', () => {
    const props = makeProps();
    render(<NumericKeypad {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '1' }));

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: 1, history: ['1'] });
  });

  it('accepts a touch activation even when no compatibility click is emitted', () => {
    const props = makeProps();
    render(<NumericKeypad {...props} />);
    const button = screen.getByRole('button', { name: '1' });

    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(button, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: 1, history: ['1'] });
  });

  it('does not activate a button when the same touch becomes a horizontal swipe', () => {
    const props = makeProps();
    render(<NumericKeypad {...props} />);
    const button = screen.getByRole('button', { name: '1' });

    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(button, {
      touches: [{ clientX: 60, clientY: 100 }],
    });
    fireEvent.touchEnd(button, {
      changedTouches: [{ clientX: 60, clientY: 100 }],
    });

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('does not duplicate a touch activation when a compatibility click follows', () => {
    const props = makeProps();
    render(<NumericKeypad {...props} />);
    const button = screen.getByRole('button', { name: '1' });

    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(button, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.click(button, { detail: 1 });

    expect(props.onChange).toHaveBeenCalledTimes(1);
  });
});

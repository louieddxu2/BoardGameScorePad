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
  it.each([
    { value: 0, overwrite: false, name: '-' },
    { value: 12, overwrite: false, name: '+/-' },
    { value: -12, overwrite: false, name: '+/-' },
    { value: 12, overwrite: true, name: '-' },
  ])('uses the digit typography and theme for $name with value $value and overwrite $overwrite', ({ value, overwrite, name }) => {
    render(<NumericKeypad {...makeProps()} value={value} overwrite={overwrite} />);
    const sign = screen.getByRole('button', { name });
    const digit = screen.getByRole('button', { name: '1' });

    expect(sign).toHaveClass('text-[32px]', 'leading-none', 'font-bold');
    expect(sign).not.toHaveClass('font-mono');
    expect(sign).not.toHaveClass('text-xl');
    expect(sign).not.toHaveClass('text-txt-muted');
    const theme = overwrite ? ['bg-keypad-active', 'text-white'] : ['bg-keypad-bg', 'text-keypad-text'];
    expect(sign).toHaveClass(...theme);
    expect(digit).toHaveClass(...theme);
  });

  it.each([
    { value: 0, overwrite: true, name: '-', expected: '-0' },
    { value: 12, overwrite: false, name: '+/-', expected: '-12' },
    { value: -12, overwrite: false, name: '+/-', expected: '12' },
  ])('preserves sign activation with value $value and overwrite $overwrite', ({ value, overwrite, name, expected }) => {
    const props = makeProps();
    render(<NumericKeypad {...props} value={value} overwrite={overwrite} />);

    fireEvent.click(screen.getByRole('button', { name }));

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: expected, history: [expected] });
    expect(props.setOverwrite).toHaveBeenCalledWith(false);
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

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

const getDecimalButton = (container: HTMLElement) => {
  const button = container.querySelector('svg.lucide-dot')?.closest('button');
  if (!button) throw new Error('Decimal button was not rendered');
  return button;
};

describe('NumericKeypad', () => {
  it.each([true, false])('matches the decimal key theme to the digits with overwrite %s', (overwrite) => {
    const { container } = render(<NumericKeypad {...makeProps()} overwrite={overwrite} />);
    const decimal = getDecimalButton(container);
    const theme = overwrite ? ['bg-keypad-active', 'text-white'] : ['bg-keypad-bg', 'text-keypad-text'];
    const otherTheme = overwrite ? ['bg-keypad-bg', 'text-keypad-text'] : ['bg-keypad-active', 'text-white'];

    expect(decimal).toHaveClass(...theme);
    expect(screen.getByRole('button', { name: '1' })).toHaveClass(...theme);
    otherTheme.forEach((className) => expect(decimal).not.toHaveClass(className));
  });

  it('clears the decimal highlight after first input and restores it for the next overwrite', () => {
    const props = makeProps();
    const { container, rerender } = render(<NumericKeypad {...props} value={12} />);
    const decimal = getDecimalButton(container);
    expect(decimal).toHaveClass('bg-keypad-active', 'text-white');

    fireEvent.click(decimal);

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: '0.', history: ['0.'] });
    expect(props.setOverwrite).toHaveBeenCalledWith(false);
    rerender(<NumericKeypad {...props} value={{ value: '0.', history: ['0.'] }} overwrite={false} />);
    expect(decimal).toHaveClass('bg-keypad-bg', 'text-keypad-text');
    expect(decimal).not.toHaveClass('bg-keypad-active');
    expect(decimal).not.toHaveClass('text-white');

    rerender(<NumericKeypad {...props} value={37} overwrite={true} />);
    expect(decimal).toHaveClass('bg-keypad-active', 'text-white');
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    { value: { value: '12' }, expected: '12.' },
    { value: { value: '12.5' }, expected: '12.5' },
    { value: { value: -0 }, expected: '-0.' },
  ])('preserves decimal input for $expected without overwrite', ({ value, expected }) => {
    const props = makeProps();
    const { container } = render(<NumericKeypad {...props} value={value} overwrite={false} />);

    fireEvent.click(getDecimalButton(container));

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: expected, history: [expected] });
    expect(props.setOverwrite).toHaveBeenCalledWith(false);
  });

  it.each([0, 1] as const)('highlights and overwrites only the active product factor %s', (activeFactorIdx) => {
    const props = makeProps();
    const column = { ...props.column, formula: 'a1×a2' };
    const value = { value: 24, factors: ['12', '2'], history: [] };
    const { container, rerender } = render(<NumericKeypad {...props} column={column} value={value} activeFactorIdx={activeFactorIdx} />);
    const decimal = getDecimalButton(container);
    expect(decimal).toHaveClass('bg-keypad-active', 'text-white');

    fireEvent.click(decimal);

    const updatedValue = { value: 0, factors: activeFactorIdx === 0 ? ['0.', '2'] : ['12', '0.'], history: [] };
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(updatedValue);
    expect(props.setOverwrite).toHaveBeenCalledWith(false);
    rerender(<NumericKeypad {...props} column={column} value={updatedValue} activeFactorIdx={activeFactorIdx} overwrite={false} />);
    expect(decimal).toHaveClass('bg-keypad-bg', 'text-keypad-text');
    expect(decimal).not.toHaveClass('bg-keypad-active');
    expect(decimal).not.toHaveClass('text-white');
  });

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

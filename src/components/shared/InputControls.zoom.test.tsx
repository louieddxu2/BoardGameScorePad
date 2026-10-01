import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { LanguageProvider } from '../../i18n';
import { useMobileZoom } from '../../hooks/useMobileZoom';
import type { ScoreColumn } from '../../types';
import QuickButtonPad from './QuickButtonPad';
import NumericKeypad from './NumericKeypad';
import quickPadSource from './QuickButtonPad.tsx?raw';
import keypadSource from './NumericKeypad.tsx?raw';

const column = {
  id: 'quick',
  name: 'Quick actions',
  formula: 'a1',
  inputType: 'clicker',
  isScoring: true,
  quickActions: [{ id: 'one', label: 'One', value: 1 }],
} satisfies ScoreColumn;

const zoomCases = [
  { name: 'minimum', distance: 50, rootFontSize: '12px' },
  { name: 'default', distance: 100, rootFontSize: '16px' },
  { name: 'maximum', distance: 180, rootFontSize: '20.8px' },
];

const pinch = (target: HTMLElement, distance: number) => {
  fireEvent.touchStart(target, {
    touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }],
  });
  fireEvent.touchMove(target, {
    touches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }],
  });
  fireEvent.touchEnd(target, {
    touches: [],
    changedTouches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }],
  });
};

const makeNumericProps = (value = 0) => ({
  value,
  onChange: vi.fn(),
  onNext: vi.fn(),
  column: { ...column, inputType: 'keypad' as const },
  overwrite: false,
  setOverwrite: vi.fn(),
  activeFactorIdx: 0 as const,
  setActiveFactorIdx: vi.fn(),
  playerId: 'p1',
});

describe('input controls with app zoom', () => {
  const style = document.createElement('style');
  let previousFontSize: string;
  let previousZoom: string | null;
  let previousZoomProperty: string;

  beforeAll(async () => {
    // Generate the real font utilities from the production class names.
    // JSDOM retains rem values rather than resolving them to rendered pixels.
    const result = await postcss([tailwindcss({
      content: [{ raw: `${quickPadSource}\n${keypadSource}`, extension: 'tsx' }],
      corePlugins: ['fontSize'],
    })]).process('@tailwind utilities', { from: undefined });
    style.textContent = result.css;
    document.head.appendChild(style);
  });

  afterAll(() => { style.remove(); });

  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
    previousZoom = localStorage.getItem('app_zoom_level');
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    localStorage.removeItem('app_zoom_level');
    document.documentElement.style.removeProperty('--app-zoom-level');
    document.documentElement.style.fontSize = '16px';
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousZoom);
  });

  describe.each([
    { cols: 1, labelFontSize: '1.25rem', badgeFontSize: '1rem' },
    { cols: 2, labelFontSize: '1rem', badgeFontSize: '0.875rem' },
    { cols: 3, labelFontSize: '1rem', badgeFontSize: '0.875rem' },
  ])('$cols quick-button columns', ({ cols, labelFontSize, badgeFontSize }) => {
    it.each(zoomCases)('keeps label-only fallback text root-relative at $name zoom', ({ distance, rootFontSize }) => {
      renderHook(() => useMobileZoom());
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'label_only' }} onAction={vi.fn()} />
        </LanguageProvider>,
      );
      const label = screen.getByText('One');

      pinch(label, distance);

      expect(document.documentElement.style.fontSize).toBe(rootFontSize);
      expect(window.getComputedStyle(label).fontSize).toBe(labelFontSize);
      expect(screen.getByText('One')).toBe(label);
    });

    it.each(zoomCases)('keeps standard fallback labels and badges root-relative at $name zoom', ({ distance, rootFontSize }) => {
      renderHook(() => useMobileZoom());
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols }} onAction={vi.fn()} />
        </LanguageProvider>,
      );
      const button = screen.getByRole('button', { name: 'One 1' });

      pinch(button, distance);

      expect(document.documentElement.style.fontSize).toBe(rootFontSize);
      expect(window.getComputedStyle(within(button).getByText('One')).fontSize).toBe(labelFontSize);
      expect(window.getComputedStyle(within(button).getByText('1')).fontSize).toBe(badgeFontSize);
    });
  });

  it('preserves multiline labels and scroll bounds at maximum zoom', () => {
    const action = { ...column.quickActions[0], label: 'One two four five\nOne two four five\nOne two four five' };
    renderHook(() => useMobileZoom());
    render(
      <LanguageProvider>
        <QuickButtonPad column={{ ...column, buttonGridColumns: 3, renderMode: 'label_only', quickActions: [action] }} onAction={vi.fn()} />
      </LanguageProvider>,
    );
    const button = screen.getByRole('button');

    pinch(button, 180);

    const label = within(button).getByText(/One two four five/);
    expect(label.textContent).toBe(action.label);
    expect(label).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(button.closest('.overflow-y-auto')).toHaveClass('flex-1', 'min-h-0');
    expect(button.parentElement).toHaveStyle({ gridAutoRows: 'minmax(4.5rem, auto)' });
  });

  describe.each([1, 3])('pinching with %i quick-button columns', (buttonGridColumns) => {
    it.each(['standard', 'label_only'] as const)('does not select an option in %s mode', (renderMode) => {
      const onAction = vi.fn();
      renderHook(() => useMobileZoom());
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns, renderMode }} onAction={onAction} />
        </LanguageProvider>,
      );

      pinch(screen.getByRole('button'), 180);

      expect(onAction).not.toHaveBeenCalled();
    });
  });

  it.each(zoomCases)('preserves fixed keypad digit and minus sizes at $name zoom', ({ distance, rootFontSize }) => {
    renderHook(() => useMobileZoom());
    render(<NumericKeypad {...makeNumericProps()} />);
    const digit = screen.getByRole('button', { name: '1' });

    pinch(digit, distance);

    expect(document.documentElement.style.fontSize).toBe(rootFontSize);
    expect(window.getComputedStyle(digit).fontSize).toBe('32px');
    expect(window.getComputedStyle(screen.getByRole('button', { name: '-' })).fontSize).toBe('32px');
    expect(digit.closest('[data-numeric-keypad="true"]')).toHaveClass('flex-1', 'min-h-0', 'grid-rows-4');
  });

  it.each(zoomCases)('keeps +/- on the same fixed font size as the digits at $name zoom', ({ distance, rootFontSize }) => {
    renderHook(() => useMobileZoom());
    render(<NumericKeypad {...makeNumericProps(1)} />);
    const sign = screen.getByRole('button', { name: '+/-' });

    pinch(sign, distance);

    expect(document.documentElement.style.fontSize).toBe(rootFontSize);
    expect(window.getComputedStyle(sign).fontSize).toBe('32px');
    expect(window.getComputedStyle(sign).fontSize).toBe(window.getComputedStyle(screen.getByRole('button', { name: '1' })).fontSize);
  });

  it('does not type a digit while pinching and still accepts the next tap', () => {
    const props = makeNumericProps();
    renderHook(() => useMobileZoom());
    render(<NumericKeypad {...props} />);
    const digit = screen.getByRole('button', { name: '1' });

    pinch(digit, 180);
    expect(props.onChange).not.toHaveBeenCalled();

    fireEvent.click(digit);
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith({ value: 1, history: ['1'] });
  });
});

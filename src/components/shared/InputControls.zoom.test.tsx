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

const maximumZoom = { distance: 180, rootFontSize: '20.8px' };

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

  // One list and one grid cover the two fallback-font branches at maximum zoom.
  // Per-column sizing and both zoom limits belong in QuickButtonPad.sizing.test.tsx;
  // gesture ownership and genuine next taps belong in InputControls.pinch.test.tsx.
  describe.each([
    { cols: 1, labelFontSize: '1.25rem', badgeFontSize: '1rem' },
    { cols: 3, labelFontSize: '1rem', badgeFontSize: '0.875rem' },
  ])('$cols quick-button columns', ({ cols, labelFontSize, badgeFontSize }) => {
    // Both display modes use the same fallback label classes. The standard
    // variant also verifies badge sizing; label-only height budgets and pinch
    // ownership remain covered in the sizing and pinch suites.
    it('keeps standard fallback labels and badges root-relative at maximum zoom', () => {
      const { distance, rootFontSize } = maximumZoom;
      renderHook(() => useMobileZoom());
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols }} onAction={vi.fn()} />
        </LanguageProvider>,
      );
      const button = screen.getByRole('button', { name: /^One\s*1$/ });

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

  it('preserves fixed keypad digit and minus sizes at maximum zoom', () => {
    const { distance, rootFontSize } = maximumZoom;
    renderHook(() => useMobileZoom());
    render(<NumericKeypad {...makeNumericProps()} />);
    const digit = screen.getByRole('button', { name: '1' });

    pinch(digit, distance);

    expect(document.documentElement.style.fontSize).toBe(rootFontSize);
    expect(window.getComputedStyle(digit).fontSize).toBe('32px');
    expect(window.getComputedStyle(screen.getByRole('button', { name: '-' })).fontSize).toBe('32px');
    expect(digit.closest('[data-numeric-keypad="true"]')).toHaveClass('flex-1', 'min-h-0', 'grid-rows-4');
  });

  it('keeps +/- on the same fixed font size as the digits at maximum zoom', () => {
    const { distance, rootFontSize } = maximumZoom;
    renderHook(() => useMobileZoom());
    render(<NumericKeypad {...makeNumericProps(1)} />);
    const sign = screen.getByRole('button', { name: '+/-' });

    pinch(sign, distance);

    expect(document.documentElement.style.fontSize).toBe(rootFontSize);
    expect(window.getComputedStyle(sign).fontSize).toBe('32px');
    expect(window.getComputedStyle(sign).fontSize).toBe(window.getComputedStyle(screen.getByRole('button', { name: '1' })).fontSize);
  });
});

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import QuickButtonPad from './QuickButtonPad';
import { LanguageProvider } from '../../i18n';
import type { ScoreColumn } from '../../types';
import appCss from '../../index.css?raw';

const column = {
  id: 'quick',
  name: 'Quick actions',
  formula: 'a1',
  inputType: 'clicker' as const,
  isScoring: true,
  quickActions: [
    { id: 'one', label: 'One', value: 1 },
    { id: 'two', label: 'Two', value: 2 },
  ],
} satisfies ScoreColumn;

describe('QuickButtonPad', () => {
  it.each([undefined, 'label_only'] as const)('keeps click behavior in %s mode', (renderMode) => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={{ ...column, renderMode }} onAction={onAction} /></LanguageProvider>);

    fireEvent.click(screen.getByRole('button', { name: /One/ }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(column.quickActions[0]);
  });

  it.each([undefined, 'label_only'] as const)('accepts touch activation without a compatibility click in %s mode', (renderMode) => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={{ ...column, renderMode }} onAction={onAction} /></LanguageProvider>);
    const button = screen.getByRole('button', { name: /One/ });

    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(button, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(column.quickActions[0]);
  });

  it.each([undefined, 'label_only'] as const)('does not activate after a swipe in %s mode', (renderMode) => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={{ ...column, renderMode }} onAction={onAction} /></LanguageProvider>);
    const button = screen.getByRole('button', { name: /One/ });

    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(button, {
      touches: [{ clientX: 140, clientY: 100 }],
    });
    fireEvent.touchEnd(button, {
      changedTouches: [{ clientX: 140, clientY: 100 }],
    });

    expect(onAction).not.toHaveBeenCalled();
  });

  describe.each([1, 3])('label-only mode with %i button columns', (buttonGridColumns) => {
    it.each([0, -7, 42])('hides value %i while preserving the label and action', (value) => {
      const action = { id: 'stage', label: 'Stage 2', value };
      const onAction = vi.fn();
      render(
        <LanguageProvider>
          <QuickButtonPad
            column={{ ...column, buttonGridColumns, renderMode: 'label_only', quickActions: [action] }}
            onAction={onAction}
          />
        </LanguageProvider>,
      );
      const button = screen.getByRole('button');

      expect(button).toHaveAccessibleName('Stage 2');
      expect(within(button).queryByText(String(value))).not.toBeInTheDocument();
      expect(within(button).getByText('Stage 2').parentElement).not.toHaveClass('mb-[4px]');

      fireEvent.click(button);

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction.mock.calls[0][0]).toBe(action);
      expect(action.value).toBe(value);
    });
  });

  it.each([undefined, 'standard', 'value_only'] as const)('keeps numeric badges in %s mode', (renderMode) => {
    render(<LanguageProvider><QuickButtonPad column={{ ...column, renderMode }} onAction={vi.fn()} /></LanguageProvider>);

    expect(screen.getByRole('button', { name: 'One 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Two 2' })).toBeInTheDocument();
  });

  it.each([
    { name: 'single-select', currentOptionId: 'one', currentMultiOptionIds: undefined, isMultiSelect: false },
    { name: 'multi-select', currentOptionId: undefined, currentMultiOptionIds: ['one'], isMultiSelect: true },
  ])('retains $name highlighting in label-only mode', ({ currentOptionId, currentMultiOptionIds, isMultiSelect }) => {
    render(
      <LanguageProvider>
        <QuickButtonPad
          column={{ ...column, renderMode: 'label_only', isMultiSelect }}
          currentOptionId={currentOptionId}
          currentMultiOptionIds={currentMultiOptionIds}
          onAction={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'One' })).toHaveClass('ring-2');
    expect(screen.getByRole('button', { name: 'Two' })).not.toHaveClass('ring-2');
  });
});

describe('QuickButtonPad fixed-background contrast', () => {
  const style = document.createElement('style');
  // Use the real palette and both theme mappings, without Tailwind-only at-rules.
  style.textContent = [...appCss.matchAll(/(?::root|html\[data-theme='light'\])\s*\{[^}]*\}/g)]
    .map(match => match[0]).join('\n');
  let previousTheme: string | null;

  beforeAll(() => { document.head.appendChild(style); });
  afterAll(() => { style.remove(); });
  beforeEach(() => { previousTheme = document.documentElement.getAttribute('data-theme'); });
  afterEach(() => {
    if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', previousTheme);
  });

  const contrastCases: {
    name: string;
    actionColor?: string;
    columnColor?: string;
    backgroundColor: string;
    textColor: string;
  }[] = [
    { name: 'black player color', actionColor: 'rgb(var(--c-p-black))', backgroundColor: 'rgb(var(--c-p-black))', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'white player color', actionColor: 'rgb(var(--c-p-white))', backgroundColor: 'rgb(var(--c-p-white))', textColor: 'rgb(var(--c-slate-900))' },
    { name: 'yellow player color', actionColor: 'rgb(var(--c-p-yellow))', backgroundColor: 'rgb(var(--c-p-yellow))', textColor: 'rgb(var(--c-slate-900))' },
    { name: 'skin player color', actionColor: 'rgb(var(--c-p-skin))', backgroundColor: 'rgb(var(--c-p-skin))', textColor: 'rgb(var(--c-slate-900))' },
    { name: 'blue player color', actionColor: 'rgb(var(--c-p-blue))', backgroundColor: 'rgb(var(--c-p-blue))', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'red player color', actionColor: 'rgb(var(--c-p-red))', backgroundColor: 'rgb(var(--c-p-red))', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'custom dark hex', actionColor: '#123456', backgroundColor: 'rgb(18, 52, 86)', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'custom light hex', actionColor: '#eeeeee', backgroundColor: 'rgb(238, 238, 238)', textColor: 'rgb(var(--c-slate-900))' },
    { name: 'custom dark RGB', actionColor: 'rgb(20, 40, 60)', backgroundColor: 'rgb(20, 40, 60)', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'custom light RGB', actionColor: 'rgb(240, 240, 240)', backgroundColor: 'rgb(240, 240, 240)', textColor: 'rgb(var(--c-slate-900))' },
    { name: 'column color fallback', columnColor: 'rgb(var(--c-p-blue))', backgroundColor: 'rgb(var(--c-p-blue))', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'action color over column color', actionColor: 'rgb(var(--c-p-red))', columnColor: 'rgb(var(--c-p-white))', backgroundColor: 'rgb(var(--c-p-red))', textColor: 'rgb(var(--c-slate-50))' },
    { name: 'default white background', backgroundColor: 'rgb(var(--c-white))', textColor: 'rgb(var(--c-slate-900))' },
  ];

  describe.each(['dark', 'light'])('%s theme', (theme) => {
    beforeEach(() => { document.documentElement.setAttribute('data-theme', theme); });

    it.each(contrastCases)('uses fixed text contrast for $name', ({ actionColor, columnColor, backgroundColor, textColor }) => {
      const action = { ...column.quickActions[0], color: actionColor };
      render(
        <LanguageProvider>
          <QuickButtonPad
            column={{ ...column, color: columnColor, quickActions: [action] }}
            currentOptionId={action.id}
            onAction={vi.fn()}
          />
        </LanguageProvider>,
      );
      const button = screen.getByRole('button');

      expect(button).toHaveStyle({ backgroundColor });
      expect(within(button).getByText('One')).toHaveStyle({ color: textColor });
      expect(within(button).getByText('1')).toHaveStyle({ color: textColor });
    });
  });

  it('keeps label-only contrast fixed when switching themes without remounting', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themedColumn: ScoreColumn = {
      ...column,
      renderMode: 'label_only',
      quickActions: [
        { id: 'dark', label: 'Dark', value: 1, color: 'rgb(var(--c-p-black))' },
        { id: 'light', label: 'Light', value: 2, color: 'rgb(var(--c-p-white))' },
      ],
    };
    render(<LanguageProvider><QuickButtonPad column={themedColumn} onAction={vi.fn()} /></LanguageProvider>);
    const darkLabel = screen.getByText('Dark');
    const lightLabel = screen.getByText('Light');

    expect(darkLabel).toHaveStyle({ color: 'rgb(var(--c-slate-50))' });
    expect(lightLabel).toHaveStyle({ color: 'rgb(var(--c-slate-900))' });

    document.documentElement.setAttribute('data-theme', 'light');

    expect(darkLabel).toHaveStyle({ color: 'rgb(var(--c-slate-50))' });
    expect(lightLabel).toHaveStyle({ color: 'rgb(var(--c-slate-900))' });
  });
});

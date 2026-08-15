import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickButtonPad from './QuickButtonPad';
import { LanguageProvider } from '../../i18n';

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
};

describe('QuickButtonPad', () => {
  it('keeps the existing click behavior', () => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={column} onAction={onAction} /></LanguageProvider>);

    fireEvent.click(screen.getByRole('button', { name: /One/ }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(column.quickActions[0]);
  });

  it('accepts a touch activation when no compatibility click is emitted', () => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={column} onAction={onAction} /></LanguageProvider>);
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

  it('does not activate after the same touch becomes a swipe', () => {
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={column} onAction={onAction} /></LanguageProvider>);
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
});

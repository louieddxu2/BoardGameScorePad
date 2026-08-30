import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { ScoreColumn } from '../../../types';
import ScoreInfoPanel from './ScoreInfoPanel';

const baseColumn: ScoreColumn = {
  id: 'score',
  name: 'Score',
  formula: 'a1',
  inputType: 'keypad',
  isScoring: true,
  rounding: 'none',
};

const columns: ScoreColumn[] = [
  baseColumn,
  { ...baseColumn, id: 'product', formula: 'a1×a2' },
  { ...baseColumn, id: 'parts', formula: 'a1+next' },
  {
    ...baseColumn,
    id: 'mapping',
    formula: 'f1(a1)',
    f1: [{ min: 0, max: 'next', score: 0 }],
  },
];

describe('ScoreInfoPanel sizing', () => {
  it.each(columns)('fills the sidebar through flex sizing for $id', (column) => {
    const { container } = render(
      <LanguageProvider>
        <ScoreInfoPanel column={column} value={{ value: 0, history: [] }} />
      </LanguageProvider>,
    );

    const panel = container.firstElementChild;

    expect(panel).toHaveClass('flex-1', 'min-h-0');
    expect(panel).not.toHaveClass('h-full');
  });
});

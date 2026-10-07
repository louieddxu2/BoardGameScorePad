import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { Player, ScoreColumn } from '../../../types';
import * as scoring from '../../../utils/scoring';
import ScoreCell from './ScoreCell';

const column: ScoreColumn = {
  id: 'labels', name: 'Labels', formula: 'a1', inputType: 'clicker', isScoring: true,
  isMultiSelect: true, renderMode: 'label_only',
  contentLayout: { x: 0, y: 0, width: 100, height: 100 },
  visuals: { cellRect: { x: 0, y: 0, width: 100, height: 100 } },
  quickActions: [{ id: 'a', label: 'A\nB', value: 2, color: '#ff0000' }, { id: 'b', label: 'C', value: 3 }]
};
const player: Player = { id: 'p1', name: 'Alice', color: '#ff0000', totalScore: 5,
  scores: { labels: { parts: [2, 3], multiOptionIds: ['a', 'b'] } } };

describe('label-only score cell layout', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('reuses the selected options for measurement and rendering in both normal and textured cells', () => {
    const resolver = vi.spyOn(scoring, 'resolveSelectedOptions');
    for (const baseImage of [undefined, 'unused-texture']) {
      resolver.mockClear();
      const view = render(<LanguageProvider><ScoreCell player={player} playerIndex={0} column={column}
        allColumns={[column]} allPlayers={[player]} isActive={false} onClick={vi.fn()}
        baseImage={baseImage} skipTextureRendering /></LanguageProvider>);
      expect(['A', 'B', 'C'].map(label => view.getByText(label).textContent)).toEqual(['A', 'B', 'C']);
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(view.getByText('A').style.color).toBe('rgb(255, 0, 0)');
      view.unmount();
    }
  });
});

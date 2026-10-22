import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n';
import { Player, ScoreColumn } from '../../../types';
import TexturedTotalCell from './TexturedTotalCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedScoreCell from './TexturedScoreCell';
import * as imageProcessing from '../../../utils/imageProcessing';

const player: Player = {
  id: 'player-1',
  name: 'Player 1',
  color: '#ef4444',
  scores: {},
  totalScore: 42,
};

const renderCell = (scoringRule?: 'HIGHEST_WINS' | 'LOWEST_WINS' | 'COMPETITIVE_NO_SCORE') => render(
  <LanguageProvider>
    <TexturedTotalCell
      player={player}
      playerIndex={0}
      isWinner
      hasMultiplePlayers={false}
      baseImage=""
      scoringRule={scoringRule}
    />
  </LanguageProvider>
);

describe('TexturedTotalCell winner crown', () => {
  it('shows the crown for the winner in a solo highest-score game', () => {
    const { container } = renderCell('HIGHEST_WINS');

    expect(container.querySelector('svg.lucide-crown')).not.toBeNull();
  });

  it('shows the crown for the winner in a solo lowest-score game', () => {
    const { container } = renderCell('LOWEST_WINS');

    expect(container.querySelector('svg.lucide-crown')).not.toBeNull();
  });

  it('uses the default highest-score rule when no scoring rule is provided', () => {
    const { container } = renderCell();

    expect(container.querySelector('svg.lucide-crown')).not.toBeNull();
  });

  it('does not show the crown for a no-score competitive mode', () => {
    const { container } = renderCell('COMPETITIVE_NO_SCORE');

    expect(container.querySelector('svg.lucide-crown')).toBeNull();
  });

});

it('preserves chosen player and option ink after textures load, using edges instead of multiply blending', async () => {
  const texture = vi.spyOn(imageProcessing, 'getSmartTextureUrl').mockResolvedValue('blob:test-texture');
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  const touchHandlers = { onPointerDown: vi.fn(), onTouchStart: vi.fn(), onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(), onTouchCancel: vi.fn(), onClick: vi.fn() };
  const columns: ScoreColumn[] = [
    { id: 'label', name: 'Label', inputType: 'clicker', formula: 'a1', isScoring: true, renderMode: 'label_only' },
    { id: 'positioned', name: 'Positioned', inputType: 'clicker', formula: 'a1', isScoring: true, renderMode: 'label_only', contentLayout: rect },
    { id: 'standard', name: 'Standard', inputType: 'clicker', formula: 'a1', isScoring: true, renderMode: 'standard' },
  ];
  try {
    const { getByText, unmount } = render(<LanguageProvider>
      <TexturedPlayerHeader player={player} playerIndex={0} baseImage="photo" rect={rect} onClick={vi.fn()} isEditing={false} />
      <TexturedTotalCell player={{ ...player, isForceLost: true }} playerIndex={0} baseImage="photo" rect={rect}
        isWinner={false} hasMultiplePlayers={false} />
      {columns.map(column => <TexturedScoreCell key={column.id} player={player} playerIndex={0}
        column={{ ...column, quickActions: [{ id: 'choice', label: column.name, value: 1, color: '#3b82f6' }] }}
        scoreValue={{ parts: [1], optionId: 'choice' }} baseImage="photo" rect={rect}
        onClick={vi.fn()} isActive={false} touchHandlers={touchHandlers} />)}
    </LanguageProvider>);
    await waitFor(() => expect(getByText(player.name)).toHaveStyle({ mixBlendMode: 'normal' }));
    for (const element of [getByText(player.name), getByText('42')]) {
      expect(element).toHaveStyle({ color: player.color, mixBlendMode: 'normal' });
      expect(element.style.textShadow).not.toBe('none');
    }
    for (const column of columns) {
      const label = getByText(text => text.replace(/\u00ad/g, '') === column.name);
      expect(label).toHaveStyle({ color: '#3b82f6', mixBlendMode: 'normal' });
      expect(label.style.textShadow).not.toBe('none');
    }
    expect(player.color).toBe('#ef4444');
    unmount();
  } finally {
    texture.mockRestore();
  }
});

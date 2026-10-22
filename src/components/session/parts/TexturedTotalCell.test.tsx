import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n';
import { Player } from '../../../types';
import TexturedTotalCell from './TexturedTotalCell';

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

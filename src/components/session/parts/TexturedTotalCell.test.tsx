import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageContext, LanguageProvider } from '../../../i18n';
import { Player } from '../../../types';
import TexturedTotalCell from './TexturedTotalCell';

const player: Player = {
  id: 'player-1',
  name: 'Player 1',
  color: '#ef4444',
  scores: {},
  totalScore: 42,
};

const renderCell = (
  scoringRule?: 'HIGHEST_WINS' | 'LOWEST_WINS' | 'COOP' | 'COMPETITIVE_NO_SCORE',
  options: { totalScore?: number; isWinner?: boolean; showOutcomeWhenAllScoresZero?: boolean } = {},
) => render(
  <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
    <TexturedTotalCell
      player={{ ...player, totalScore: options.totalScore ?? player.totalScore }}
      playerIndex={0}
      isWinner={options.isWinner ?? true}
      hasMultiplePlayers={false}
      baseImage=""
      scoringRule={scoringRule}
      showOutcomeWhenAllScoresZero={options.showOutcomeWhenAllScoresZero}
    />
  </LanguageContext.Provider>
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

  it('shows the win outcome instead of zero in a photo-style scoring screenshot', () => {
    const { container, queryByText, getByText } = renderCell('HIGHEST_WINS', {
      totalScore: 0,
      showOutcomeWhenAllScoresZero: true,
    });

    expect(getByText('勝')).toBeInTheDocument();
    expect(queryByText('0')).toBeNull();
  });

  it('shows the loss outcome for a zero-score non-winner', () => {
    const { getByText, queryByText } = renderCell('LOWEST_WINS', {
      totalScore: 0,
      isWinner: false,
      showOutcomeWhenAllScoresZero: true,
    });

    expect(getByText('負')).toBeInTheDocument();
    expect(queryByText('0')).toBeNull();
  });

  it('keeps zero numeric when the all-scores-zero flag is false', () => {
    const { getByText, queryByText } = renderCell('HIGHEST_WINS', { totalScore: 0 });

    expect(getByText('0')).toBeInTheDocument();
    expect(queryByText('勝')).toBeNull();
  });

  it('keeps zero numeric for no-score modes', () => {
    const { getByText, queryByText } = renderCell('COMPETITIVE_NO_SCORE', {
      totalScore: 0,
      showOutcomeWhenAllScoresZero: true,
    });

    expect(getByText('0')).toBeInTheDocument();
    expect(queryByText('勝')).toBeNull();
  });
});

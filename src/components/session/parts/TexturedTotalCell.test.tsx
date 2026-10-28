import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n';
import { Player } from '../../../types';
import TexturedTotalCell from './TexturedTotalCell';
import { getContrastTextStyles } from '../../../utils/ui';

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

it('protects white total-input preview ink using the shared theme policy and preserves typed formatting', () => {
  const previous = document.documentElement.getAttribute('data-theme');
  const whitePlayer = { ...player, color: 'rgb(var(--c-p-white))' };
  const preview = () => <LanguageProvider><TexturedTotalCell
    player={whitePlayer} playerIndex={0} isWinner={false} hasMultiplePlayers={false}
    baseImage="" isActive previewValue="5."
  /></LanguageProvider>;
  try {
    const { rerender, unmount } = render(preview());
    for (const theme of ['light', 'sage', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const color of ['rgb(var(--c-p-white))', '#ffffff']) {
        whitePlayer.color = color;
        rerender(preview());
        const number = screen.getByText('5.');
        const expected = getContrastTextStyles(color);
        expect(number).toHaveStyle({ color });
        expect(number.style.textShadow).toBe(expected.textShadow);
        expect(number.style.textShadow).toContain(theme === 'dark' ? 'rgba(0,0,0,0.8)' : '1px 0 0 rgba(0,0,0,1)');
        expect(number.style.fontWeight).toBe(theme === 'dark' ? '' : '400');
      }
    }
    unmount();
  } finally {
    if (previous === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', previous);
  }
});

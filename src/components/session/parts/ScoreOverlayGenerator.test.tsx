import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageContext } from '../../../i18n';
import { Player } from '../../../types';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';

const createPlayer = (id: string, name: string, totalScore: number): Player => ({
  id,
  name,
  color: '#ef4444',
  scores: {},
  totalScore,
});

const renderOverlay = (data: OverlayData) => render(
  <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
    <ScoreOverlayGenerator imageSrc="photo.jpg" data={data} />
  </LanguageContext.Provider>,
);

const baseData = (players: Player[], winners: string[], scoringRule: OverlayData['scoringRule']): OverlayData => ({
  gameName: 'Test game',
  date: 0,
  players,
  winners,
  scoringRule,
});

describe('ScoreOverlayGenerator zero-score outcomes', () => {
  it('shows outcomes instead of zero when all players tie at zero in a scoring game', () => {
    const players = [
      createPlayer('p1', 'Alice', 0),
      createPlayer('p2', 'Bob', 0),
    ];
    const data = baseData(players, players.map(player => player.id), 'HIGHEST_WINS');

    const { queryAllByText, getAllByText } = renderOverlay(data);

    expect(getAllByText('勝')).toHaveLength(2);
    expect(queryAllByText('0')).toHaveLength(0);
  });

  it('keeps zero numeric when any player has a non-zero score', () => {
    const players = [
      createPlayer('p1', 'Alice', 0),
      createPlayer('p2', 'Bob', 5),
    ];

    const { queryAllByText, queryByText } = renderOverlay(baseData(players, ['p2'], 'HIGHEST_WINS'));

    expect(queryAllByText('0')).toHaveLength(1);
    expect(queryByText('勝')).toBeNull();
    expect(queryByText('負')).toBeNull();
  });

  it('uses 敗 for a zero-score non-winner when the scoring result is decided', () => {
    const players = [
      createPlayer('p1', 'Alice', 0),
      createPlayer('p2', 'Bob', 0),
    ];

    const { getByText, queryByText } = renderOverlay(baseData(players, ['p1'], 'HIGHEST_WINS'));

    expect(getByText('敗')).toBeInTheDocument();
    expect(queryByText('負')).toBeNull();
  });

  it('keeps zero numeric in no-score modes', () => {
    const players = [
      createPlayer('p1', 'Alice', 0),
      createPlayer('p2', 'Bob', 0),
    ];

    const { queryAllByText, queryByText } = renderOverlay(baseData(players, [], 'COMPETITIVE_NO_SCORE'));

    expect(queryAllByText('0')).toHaveLength(2);
    expect(queryByText('勝')).toBeNull();
    expect(queryByText('負')).toBeNull();
  });
});

describe('photo-first score export layout', () => {
  it('keeps the whole photo, player order, top-right crowns, anonymous names and bottom metadata', () => {
    const players = [
      createPlayer('p1', 'Alice', 128), createPlayer('p2', 'Bob', 115),
      { ...createPlayer('p3', 'Private name', 102), isAnonymous: true },
      createPlayer('p4', 'Dana', 96), createPlayer('p5', 'Eve', 80),
    ];
    const data = { ...baseData(players, ['p1', 'p4'], 'HIGHEST_WINS'), endTime: 1_760_000_000_000 };
    const { container, getByText, queryByText } = renderOverlay(data);
    const root = container.firstElementChild as HTMLElement;
    const image = container.querySelector('[data-score-photo-source]') as HTMLImageElement;
    const title = container.querySelector('[data-score-photo-title]')!;
    expect(image.parentElement).toBe(title.parentElement?.parentElement);
    expect(image).toHaveStyle({ width: '100%', height: 'auto' });
    expect(root).toHaveStyle({ width: '1080px', fontSize: '16px' });
    expect(getByText(data.gameName)).toHaveStyle({ fontSize: '44px' });
    expect(queryByText('Private name')).toBeNull();

    const entries = Array.from(container.querySelectorAll<HTMLElement>('[data-score-photo-player]'));
    expect(entries.map(entry => entry.dataset.scorePhotoPlayer)).toEqual(players.map(player => player.id));
    expect(entries[0]).toHaveStyle({ width: '328px' });
    const crowns = container.querySelectorAll('[data-score-photo-winner]');
    expect(Array.from(crowns).map(crown => crown.parentElement?.dataset.scorePhotoPlayer)).toEqual(['p1', 'p4']);
    for (const crown of crowns) expect(crown).toHaveStyle({ top: '4px', right: '4px' });

    const metadata = container.querySelector('[data-score-photo-metadata]')!;
    expect(root.lastElementChild).toBe(metadata);
    expect(metadata.firstElementChild?.textContent).toContain(new Date(data.endTime).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }));
    expect(metadata.lastElementChild).toHaveTextContent('萬用桌遊計分板');
    expect(metadata.lastElementChild).toHaveStyle({ marginLeft: 'auto', textAlign: 'right' });
  });
});

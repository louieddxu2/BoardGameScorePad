import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageContext } from '../../../i18n';
import { Player } from '../../../types';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';
import { PHOTO_TITLE_FALLBACK } from '../../../utils/photoTitleContrast';
import { getPlayerStickerIndices } from './StickerElement';

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
  it('groups each identity, its top-right crown and score without exposing anonymous names', () => {
    const players: OverlayData['players'] = [
      createPlayer('p1', 'Alice', 128), createPlayer('p2', 'Bob', 115),
      { ...createPlayer('p3', 'Private name', 102), isAnonymous: true },
      createPlayer('p4', 'A longer player name that wraps', 96), createPlayer('p5', 'Eve', 80),
    ];
    const data = { ...baseData(players, ['p1', 'p3', 'p4'], 'HIGHEST_WINS'), endTime: 1_760_000_000_000 };
    const { container, getByText, queryByText } = renderOverlay(data);
    const root = container.firstElementChild as HTMLElement;
    const image = container.querySelector('[data-score-photo-source]') as HTMLImageElement;
    const title = container.querySelector('[data-score-photo-title]')!;
    expect(image.parentElement).toBe(title.parentElement?.parentElement);
    expect(image).toHaveStyle({ width: '100%', height: 'auto' });
    expect(root).toHaveStyle({ width: '1080px', fontSize: '16px' });
    expect(getByText(data.gameName)).toHaveStyle({ fontSize: '44px' });
    expect(title).toHaveStyle({ textShadow: `var(--photo-title-shadow, ${PHOTO_TITLE_FALLBACK.shadow})` });
    expect(queryByText('Private name')).toBeNull();

    const entries = Array.from(container.querySelectorAll<HTMLElement>('[data-score-photo-player]'));
    expect(entries.map(entry => entry.dataset.scorePhotoPlayer)).toEqual(players.map(player => player.id));
    expect(entries[0]).toHaveStyle({ width: '220px' });
    // Five players retain three columns and a centered second row, not 4+1.
    expect(container.querySelector('[data-score-photo-results]')).toHaveStyle({ width: '756px', alignSelf: 'center' });
    entries.forEach((entry, index) => {
      expect(entry).toHaveClass('bg-surface-bg', 'border-2', 'border-surface-border', 'justify-between');
      expect(entry).toHaveStyle({ borderRadius: '12px' });
      const identity = entry.querySelector('[data-score-photo-identity]')!;
      expect(identity.parentElement).toBe(entry);
      expect(identity).toHaveClass('relative');
      expect(entry.lastElementChild).toHaveTextContent(String(players[index].totalScore));
      if (players[index].isAnonymous) expect(identity.querySelector('[data-sticker-icon]')).not.toBeNull();
      else {
        expect(identity).toHaveTextContent(players[index].name);
        expect(identity.querySelector('span')).toHaveStyle({ fontSize: '32px', overflowWrap: 'anywhere' });
      }
    });
    const crowns = container.querySelectorAll('[data-score-photo-winner]');
    expect(Array.from(crowns).map(crown => crown.closest<HTMLElement>('[data-score-photo-player]')?.dataset.scorePhotoPlayer))
      .toEqual(['p1', 'p3', 'p4']);
    for (const crown of crowns) {
      expect(crown.parentElement).toHaveAttribute('data-score-photo-identity', 'true');
      expect(crown.parentElement).toHaveStyle({ padding: '10px 28px 0px', maxWidth: '100%' });
      expect(crown).toHaveStyle({ top: '0px', right: '0px' });
      expect(crown).toHaveAttribute('width', '24');
    }

    const metadata = container.querySelector('[data-score-photo-metadata]')!;
    expect(root.lastElementChild).toBe(metadata);
    expect(metadata.firstElementChild?.textContent).toContain(new Date(data.endTime).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }));
    expect(metadata.lastElementChild).toHaveTextContent('萬用桌遊計分板');
    expect(metadata.lastElementChild).toHaveStyle({ marginLeft: 'auto', textAlign: 'right' });
  });

  it('does not expand a two-player result to fill the photo width', () => {
    const players = [createPlayer('p1', 'Alice', 128), createPlayer('p2', 'Bob', 115)];
    const { container } = renderOverlay(baseData(players, ['p1'], 'HIGHEST_WINS'));
    const results = container.querySelector('[data-score-photo-results]')!;
    expect(results).toHaveStyle({ width: '520px', alignSelf: 'center', maxWidth: '100%' });
    expect(results).toHaveClass('justify-center', 'flex-wrap');
    for (const entry of results.querySelectorAll('[data-score-photo-player]')) {
      expect(entry).toHaveStyle({ width: '220px' });
    }
    expect(container.firstElementChild).toHaveStyle({ width: '1080px' });
  });

  it('limits long titles to two ellipsized lines without shortening the source name or replacing the photo', () => {
    const gameName = 'A very long game name 與非常長的桌遊名稱 '.repeat(12);
    const data = { ...baseData([createPlayer('p1', 'Alice', 12)], ['p1'], 'HIGHEST_WINS'), gameName };
    const { container } = renderOverlay(data);
    const title = container.querySelector<HTMLElement>('[data-score-photo-title]')!;
    expect(title.textContent).toBe(gameName);
    expect(title).toHaveClass('line-clamp-2');
    expect(title).toHaveStyle({ padding: '2px' });
    expect(title).toHaveStyle({ textShadow: `var(--photo-title-shadow, ${PHOTO_TITLE_FALLBACK.shadow})` });
    expect(container.querySelector('[data-score-photo-source]')).toHaveAttribute('src', 'photo.jpg');
    expect(data.gameName).toBe(gameName);
  });

  it('keeps colliding anonymous identities distinct and stable across photo, mask and roster-order changes', () => {
    // These IDs have the same hash remainder in the eleven-shape pool.
    const players = ['a', 'l', 'w'].map(id => ({ ...createPlayer(id, `Private ${id}`, 100), isAnonymous: true }));
    const data = baseData(players, ['a'], 'HIGHEST_WINS');
    const { container, rerender } = renderOverlay(data);
    const stickers = () => new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-score-photo-player]'))
      .map(entry => [entry.dataset.scorePhotoPlayer, entry.querySelector('[data-sticker-icon]')?.getAttribute('class')]));
    const before = stickers();
    expect(new Set(before.values()).size).toBe(3);
    expect(container.querySelectorAll('.lucide-crown')).toHaveLength(1); // Only the actual winner.
    for (const player of players) expect(container.textContent).not.toContain(player.name);

    rerender(<LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
      <ScoreOverlayGenerator imageSrc="another-photo.jpg" data={{ ...data, players: [...players].reverse()
        .map(player => player.id === 'a' ? { ...player, isAnonymous: false } : player) }} />
    </LanguageContext.Provider>);
    const after = stickers();
    for (const id of ['l', 'w']) expect(after.get(id)).toBe(before.get(id));
    expect(container.textContent).toContain('Private a');
    expect(container.textContent).not.toContain('Private l');
    expect(container.textContent).not.toContain('Private w');
  });

  it('reuses shapes deterministically without an unbounded collision search when the roster exceeds the pool', () => {
    const ids = Array.from({ length: 24 }, (_, index) => String(index));
    const assignments = getPlayerStickerIndices(ids);
    expect(assignments.size).toBe(ids.length);
    expect(new Set(assignments.values()).size).toBe(11);
    expect(getPlayerStickerIndices([...ids].reverse())).toEqual(assignments);
  });
});

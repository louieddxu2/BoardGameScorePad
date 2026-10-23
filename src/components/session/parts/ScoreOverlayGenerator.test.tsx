import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageContext } from '../../../i18n';
import { Player } from '../../../types';
import ScoreOverlayGenerator, { OverlayData } from './ScoreOverlayGenerator';
import { PHOTO_TITLE_FALLBACK } from '../../../utils/photoTitleContrast';
import { getPhotoNamePlateBackground } from '../../../utils/photoNamePlate';
import { getPhotoPlayerNameStyles } from '../../../utils/photoTextContrast';
import { getPlayerStickerIndices } from './StickerElement';
import { calculateWinners } from '../../../utils/templateUtils';

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

  it('keeps zero numeric in no-win/loss modes', () => {
    const players = [
      createPlayer('p1', 'Alice', 0),
      createPlayer('p2', 'Bob', 0),
    ];

    const { queryAllByText, queryByText } = renderOverlay(baseData(players, [], 'COMPETITIVE_NO_SCORE'));

    expect(queryAllByText('0')).toHaveLength(2);
    expect(queryByText('勝')).toBeNull();
    expect(queryByText('負')).toBeNull();
  });

  it('shares default cooperative victory and a shared forced loss using the existing winner calculation', () => {
    const players: OverlayData['players'] = [
      createPlayer('p1', 'Alice', 12),
      { ...createPlayer('p2', 'Private name', 9), isAnonymous: true },
    ];
    const data = baseData(players, calculateWinners(players, 'COOP'), 'COOP');
    const { container, queryByText, getByText, rerender } = renderOverlay(data);
    const team = container.querySelector('[data-score-photo-team]')!;
    expect(team).toHaveAttribute('data-score-photo-team', 'win');
    expect(team).toHaveTextContent('團隊勝利');
    expect(team.querySelectorAll('.lucide-crown')).toHaveLength(1);
    expect(container.querySelectorAll('[data-score-photo-player] .lucide-crown')).toHaveLength(0);
    expect(getByText('12')).toBeInTheDocument();
    expect(getByText('9')).toBeInTheDocument();
    expect(queryByText('Private name')).toBeNull();
    expect(container.querySelector('[data-sticker-icon]')).not.toBeNull();

    const lostPlayers = players.map(player => ({ ...player, totalScore: 0, isForceLost: player.id === 'p2' }));
    rerender(<LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
      <ScoreOverlayGenerator imageSrc="photo.jpg" data={{ ...data, players: lostPlayers,
        winners: calculateWinners(lostPlayers, 'COOP') }} />
    </LanguageContext.Provider>);
    expect(container.querySelector('[data-score-photo-team]')).toHaveTextContent('團隊落敗');
    expect(container.querySelector('[data-score-photo-team]')).toHaveAttribute('data-score-photo-team', 'loss');
    expect(container.querySelectorAll('.lucide-crown')).toHaveLength(0);
    const sharedResult = container.querySelector('[data-score-photo-shared-result="true"]')!;
    expect(sharedResult).toContainElement(container.querySelector('[data-score-photo-team]') as HTMLElement);
    expect(sharedResult.querySelectorAll('[data-score-photo-player]')).toHaveLength(2);
    expect(sharedResult.querySelectorAll('[data-score-photo-score]')).toHaveLength(0);
    expect(queryByText('0')).toBeNull();

    // Imported history can record a team defeat without carrying local forced-loss flags.
    rerender(<LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
      <ScoreOverlayGenerator imageSrc="photo.jpg" data={{ ...data, winners: [] }} />
    </LanguageContext.Provider>);
    expect(container.querySelector('[data-score-photo-team]')).toHaveTextContent('團隊落敗');
  });

  it('shows one shared victory with names and anonymous identities when a cooperative game has no score inputs', () => {
    const players: OverlayData['players'] = [
      createPlayer('p1', 'Alice', 0),
      { ...createPlayer('p2', 'Private name', 0), isAnonymous: true, scores: { cleared: { parts: [] } } },
    ];
    const { container, getByText, queryByText } = renderOverlay(baseData(players, calculateWinners(players, 'COOP'), 'COOP'));
    const shared = container.querySelector('[data-score-photo-shared-result="true"]')!;
    expect(shared.querySelectorAll('[data-score-photo-team="win"]')).toHaveLength(1);
    expect(shared).toContainElement(getByText('團隊勝利'));
    expect(shared).toContainElement(getByText('Alice'));
    expect(shared.querySelectorAll('.lucide-crown')).toHaveLength(1);
    expect(shared.querySelector('[data-sticker-icon]')).not.toBeNull();
    expect(shared.querySelectorAll('[data-score-photo-score]')).toHaveLength(0);
    expect(queryByText('0')).toBeNull();
    expect(queryByText('Private name')).toBeNull();
  });

  it('labels an unscored no-win/loss cooperative team without zeros, preserving explicit zero inputs', () => {
    const players: OverlayData['players'] = [
      { ...createPlayer('p1', 'Alice', 0), isForceLost: true },
      { ...createPlayer('p2', 'Private name', 0), isAnonymous: true, scores: { cleared: { parts: [] } } },
    ];
    const data = baseData(players, ['p1', 'p2'], 'COOP_NO_SCORE');
    const { container, getByText, queryByText, rerender } = renderOverlay(data);
    const shared = container.querySelector('[data-score-photo-shared-result="true"]')!;
    expect(shared).toContainElement(getByText('合作模式'));
    expect(shared).toContainElement(getByText('Alice'));
    expect(shared.querySelector('[data-sticker-icon]')).not.toBeNull();
    expect(queryByText('Private name')).toBeNull();
    expect(queryByText('0')).toBeNull();
    expect(shared.querySelector('[data-score-photo-score]')).toBeNull();
    expect(container.querySelector('[data-score-photo-team]')).toBeNull();
    expect(container.querySelector('.lucide-crown')).toBeNull();

    rerender(<LanguageContext.Provider value={{ language: 'en', setLanguage: () => undefined }}>
      <ScoreOverlayGenerator imageSrc="photo.jpg" data={data} />
    </LanguageContext.Provider>);
    expect(getByText('Cooperative')).toBeInTheDocument();

    rerender(<LanguageContext.Provider value={{ language: 'en', setLanguage: () => undefined }}>
      <ScoreOverlayGenerator imageSrc="photo.jpg" data={{ ...data, players: [
        { ...players[0], scores: { points: { parts: [0] } } }, players[1],
      ] }} />
    </LanguageContext.Provider>);
    expect(container.querySelector('[data-score-photo-shared-result]')).toBeNull();
    expect(container.querySelectorAll('[data-score-photo-score]')).toHaveLength(2);
    expect(container.querySelector('[data-score-photo-team]')).toBeNull();
    expect(container.querySelector('.lucide-crown')).toBeNull();
  });

  it.each<{ label: string; scores: Player['scores']; totalScore: number; bonusScore?: number }>([
    { label: 'an explicit zero', scores: { points: { parts: [0] } }, totalScore: 0 },
    { label: 'offsetting inputs', scores: { points: { parts: [5, -5] } }, totalScore: 0 },
    { label: 'a selected zero-value option', scores: { points: { parts: [], optionId: 'zero' } }, totalScore: 0 },
    { label: 'an imported nonzero total', scores: {}, totalScore: 12 },
    { label: 'a bonus offset by score', scores: {}, totalScore: 0, bonusScore: -5 },
  ])('retains individual cooperative scores for $label', ({ label: _label, ...input }) => {
    const players = [{ ...createPlayer('p1', 'Alice', 0), ...input }, createPlayer('p2', 'Bob', 0)];
    const { container } = renderOverlay(baseData(players, calculateWinners(players, 'COOP'), 'COOP'));
    expect(container.querySelector('[data-score-photo-shared-result]')).toBeNull();
    expect(container.querySelectorAll('[data-score-photo-team="win"]')).toHaveLength(1);
    expect(Array.from(container.querySelectorAll('[data-score-photo-score]')).map(score => score.textContent))
      .toEqual([String(input.totalScore), '0']);
  });

  it('ignores supplied winners and forced losses in both no-win/loss modes while retaining scores', () => {
    const players = [{ ...createPlayer('p1', 'Alice', 12), isForceLost: true }, createPlayer('p2', 'Bob', 9)];
    const data = baseData(players, ['p1', 'p2'], 'COOP_NO_SCORE');
    const { container, rerender } = renderOverlay(data);
    expect(container.querySelector('[data-score-photo-team]')).toBeNull();
    for (const scoringRule of ['COOP_NO_SCORE', 'COMPETITIVE_NO_SCORE'] as const) {
      rerender(<LanguageContext.Provider value={{ language: 'en', setLanguage: () => undefined }}>
        <ScoreOverlayGenerator imageSrc="photo.jpg" data={{ ...data, scoringRule }} />
      </LanguageContext.Provider>);
      expect(container.querySelector('[data-score-photo-team]')).toBeNull();
      const photo = container.querySelector('[data-score-photo-source]')!;
      expect(photo.parentElement?.nextElementSibling).toBe(container.querySelector('[data-score-photo-results]'));
      expect(container.querySelectorAll('.lucide-crown')).toHaveLength(0);
      expect(container.textContent).not.toContain('Team victory');
      expect(container.textContent).not.toContain('Team defeat');
      expect(Array.from(container.querySelectorAll('[data-score-photo-player]')).map(entry => entry.lastElementChild?.textContent))
        .toEqual(['12', '9']);
    }
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
    expect(root.style.backgroundColor).toBe('var(--photo-result-background, #1e293b)');
    expect(root.style.color).toBe('var(--photo-result-text, #f8fafc)');
    expect(container.querySelector('[data-score-photo-team]')).toBeNull();
    expect(getByText(data.gameName)).toHaveStyle({ fontSize: '44px' });
    expect(title).toHaveStyle({ textShadow: `var(--photo-title-shadow, ${PHOTO_TITLE_FALLBACK.shadow})` });
    expect(queryByText('Private name')).toBeNull();

    const entries = Array.from(container.querySelectorAll<HTMLElement>('[data-score-photo-player]'));
    expect(entries.map(entry => entry.dataset.scorePhotoPlayer)).toEqual(players.map(player => player.id));
    expect(entries[0]).toHaveStyle({ width: '228px' });
    // Five players retain three columns and a centered second row, not 4+1.
    expect(container.querySelector('[data-score-photo-results]')).toHaveStyle({ width: '780px', alignSelf: 'center' });
    entries.forEach((entry, index) => {
      expect(entry).toHaveClass('bg-surface-bg', 'border-2', 'border-surface-border', 'justify-between');
      expect(entry).toHaveStyle({ borderRadius: '12px', padding: '0px', gap: '0' });
      expect(entry).toHaveClass('overflow-hidden');
      expect(entry.style.borderColor).toBe('var(--photo-result-border, #64748b)');
      expect(entry.style.backgroundColor).toBe('var(--photo-result-card, #334155)');
      const score = entry.querySelector<HTMLElement>('[data-score-photo-score]')!;
      expect(score.style.color).toBe('var(--photo-result-text, #f8fafc)');
      expect(score.style.backgroundColor).toBe('');
      expect(score).toHaveStyle({ padding: '10px 12px 12px', width: '100%' });
      const identity = entry.querySelector('[data-score-photo-identity]')!;
      expect(identity.parentElement).toBe(entry);
      expect(identity).toHaveClass('relative');
      expect(identity).toHaveStyle({ borderRadius: '0', width: '100%' });
      if (players[index].isAnonymous) {
        expect((identity as HTMLElement).style.backgroundColor).toBe('var(--photo-result-identity, #293649)');
      } else {
        expect(identity).toHaveStyle({ backgroundColor: getPhotoNamePlateBackground(players[index].color, undefined, 'dark') });
      }
      expect((identity as HTMLElement).style.boxShadow).toBe('');
      expect(entry.lastElementChild).toHaveTextContent(String(players[index].totalScore));
      if (players[index].isAnonymous) expect(identity.querySelector('[data-sticker-icon]')).not.toBeNull();
      else {
        expect(identity).toHaveTextContent(players[index].name);
        expect(identity.querySelector('span')).toHaveStyle({ fontSize: '36px', overflowWrap: 'anywhere' });
        expect(identity.querySelector('span')).toHaveStyle({ color: players[index].color });
        expect(identity.querySelector('span')?.style.textShadow).toBe(getPhotoPlayerNameStyles(players[index].color,
          getPhotoNamePlateBackground(players[index].color, undefined, 'dark')).textShadow);
      }
    });
    const crowns = container.querySelectorAll('[data-score-photo-winner]');
    expect(Array.from(crowns).map(crown => crown.closest<HTMLElement>('[data-score-photo-player]')?.dataset.scorePhotoPlayer))
      .toEqual(['p1', 'p3', 'p4']);
    for (const crown of crowns) {
      expect(crown.parentElement).toHaveAttribute('data-score-photo-identity', 'true');
      expect(crown.parentElement).toHaveStyle({ padding: '10px 44px 6px', maxWidth: '100%' });
      expect(crown).toHaveStyle({ top: '8px', right: '8px', color: '#fbbf24', stroke: '#1e293b' });
      expect((crown as SVGElement).style.strokeWidth).toBe('1.5');
      expect((crown as SVGElement).style.paintOrder).toBe('stroke fill');
      expect(crown).toHaveClass('text-status-warning');
      expect((crown as SVGElement).style.backgroundColor).toBe('');
      expect(crown).toHaveAttribute('width', '32');
      expect(crown).toHaveAttribute('height', '32');
    }

    const metadata = container.querySelector('[data-score-photo-metadata]')!;
    expect(root.lastElementChild).toBe(metadata);
    expect((metadata as HTMLElement).style.color).toBe('var(--photo-result-muted, #cbd5e1)');
    expect(metadata.firstElementChild?.textContent).toContain(new Date(data.endTime).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }));
    expect(metadata.lastElementChild).toHaveTextContent('萬用桌遊計分板');
    expect(metadata.lastElementChild).toHaveStyle({ marginLeft: 'auto', textAlign: 'right' });
  });

  it('preserves default and explicitly chosen identity colors on photo-derived surfaces', () => {
    const players: OverlayData['players'] = [
      { ...createPlayer('p1', 'Default name', 10), color: 'transparent' },
      { ...createPlayer('p2', 'Private name', 20), color: '', isAnonymous: true },
      createPlayer('p3', 'Chosen color', 30),
    ];
    const { container, getByText } = renderOverlay(baseData(players, ['p3'], 'HIGHEST_WINS'));
    expect(getByText('Default name').style.color).toBe('var(--photo-result-text, #f8fafc)');
    expect(getByText('Default name').style.textShadow).toBe('none');
    expect(getByText('Default name')).toHaveAttribute('data-score-photo-name', 'default');
    expect(getByText('Default name')).not.toHaveAttribute('data-score-photo-color');
    expect(getByText('Default name')).not.toHaveClass('font-bold');
    expect(container.querySelector('[data-sticker-icon]')).toHaveAttribute('stroke', 'var(--photo-result-text, #f8fafc)');
    expect(container.querySelector('[data-sticker-outline]')?.getAttribute('stroke')).not.toContain('--photo-result');
    expect(getByText('Chosen color')).toHaveStyle({ color: '#ef4444' });
    expect(getByText('Chosen color')).toHaveAttribute('data-score-photo-color', players[2].color);
    expect(getByText('Chosen color')).not.toHaveClass('font-bold');
  });

  it('does not expand a two-player result to fill the photo width', () => {
    const players = [createPlayer('p1', 'Alice', 128), createPlayer('p2', 'Bob', 115)];
    const { container } = renderOverlay(baseData(players, ['p1'], 'HIGHEST_WINS'));
    const results = container.querySelector('[data-score-photo-results]')!;
    expect(results).toHaveStyle({ width: '536px', alignSelf: 'center', maxWidth: '100%' });
    expect(results).toHaveClass('justify-center', 'flex-wrap');
    for (const entry of results.querySelectorAll('[data-score-photo-player]')) {
      expect(entry).toHaveStyle({ width: '228px' });
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

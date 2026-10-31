import React from 'react';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhotoGridCanvas } from './HistoryPhotoGridCanvas';
import { type EditableGridTile, formatGridDate } from '../historyPhotoGridModel';
import { PHOTO_TITLE_FALLBACK } from '../../../utils/photoTitleContrast';
import { EMPTY_PHOTO_RECAP_CONTEXT } from '../../../utils/historyPhotoRecapContext';

afterEach(cleanup);

const tile = (index: number): EditableGridTile => ({
  id: `photo-${index}`, itemKey: `item-${index}`, recordId: `record-${index}`,
  gameKey: `game-${index}`, gameName: `Game ${index}`, endTime: new Date(2026, 9, index + 1).getTime(),
  url: `blob:photo-${index}`, imageSize: { width: 1600, height: 900 },
  crop: { zoom: 1.5, offsetX: 0.1, offsetY: -0.2 },
});
const props = {
  stats: { playCount: 8, gameCount: 8, playerCount: 4, games: [] },
  context: { ...EMPTY_PHOTO_RECAP_CONTEXT, dateLabel: '2026.10.01 — 10.08', includePhotoYear: false },
  labels: { plays: 'Plays', games: 'Games', players: 'Players', recap: 'Recap', photoSelection: 'Photo selection', selectionUnit: 'games' },
};

it('overlays names and dates without caption-height rows in preview and export layouts', () => {
  for (const count of [2, 3, 8]) {
    const tiles = Array.from({ length: count }, (_, index) => tile(index));
    const { container, unmount } = render(<PhotoGridCanvas {...props} tiles={tiles} />);
    const grid = container.querySelector<HTMLElement>('.grid')!;
    expect(grid).toHaveClass('gap-[0.8cqw]');
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${count === 2 ? 1 : 2}, minmax(0, 1fr))`);
    const rows = count === 2 ? 2 : count === 3 ? 3 : count / 2;
    expect(grid.style.gridTemplateRows).toBe(`repeat(${rows}, minmax(0, 1fr))`);
    const columns = count === 2 ? 1 : 2;
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe('');
    expect(Number(grid.style.aspectRatio))
      .toBeCloseTo(1 / (rows / (columns * 16 / 9) + (rows - 1) * 0.008));
    const buttons = within(grid).getAllByRole('button');
    expect(buttons).toHaveLength(count);
    buttons.forEach((button, index) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleName(`${tiles[index].gameName} · ${formatGridDate(tiles[index].endTime, true)}`);
      const name = within(button).getByText(tiles[index].gameName);
      const date = within(button).getByText(formatGridDate(tiles[index].endTime));
      expect(name).toHaveClass('line-clamp-2', 'break-words');
      const overlay = name.parentElement!.parentElement!;
      expect(date.parentElement?.parentElement).toBe(overlay);
      expect(overlay).toHaveClass('absolute', 'top-[1.5cqw]', 'inset-x-[1.5cqw]', 'pointer-events-none');
      expect(overlay).toHaveStyle({ color: PHOTO_TITLE_FALLBACK.color });
      expect(overlay.style.textShadow).toContain('0.15cqw');
      expect(date.parentElement).toHaveClass('ml-auto', 'shrink-0');
      // Both labels sit over the existing crop; no bottom caption or opaque date badge.
      expect(overlay.parentElement?.children).toHaveLength(2);
      expect(date.parentElement?.style.background).toBe('');
      const image = within(button).getByRole('img');
      expect(image).toHaveStyle({ left: '60%', top: '30%', transform: 'translate(-50%, -50%) scale(1.5)' });
    });
    expect(buttons[0]).toHaveClass(count === 3 ? 'col-span-2' : 'col-span-1');
    unmount();
  }
});

it('keeps single-game suppression, original crop selection indices and empty/export behavior', () => {
  const tiles = [{ ...tile(0), url: '' }, tile(1), { ...tile(2), gameKey: 'game-1' }];
  const onSelect = vi.fn();
  const { container, rerender } = render(<PhotoGridCanvas {...props} tiles={tiles} onSelect={onSelect} />);
  const buttons = within(container).getAllByRole('button');
  expect(buttons).toHaveLength(2);
  expect(within(container).getByText('Games')).toBeInTheDocument();
  // The full recap still includes other games, even if every loaded photo shares one identity.
  expect(within(buttons[0]).getByText('Game 1')).toBeInTheDocument();
  expect(within(buttons[0]).getByText(formatGridDate(tiles[1].endTime))).toBeInTheDocument();
  fireEvent.click(buttons[0]);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
  const singleGameStats = { ...props.stats, gameCount: 1 };
  const singleGameContext = { ...props.context, isSingleGame: true, gameName: 'Single Game' };
  rerender(<PhotoGridCanvas {...props} context={singleGameContext} stats={singleGameStats} tiles={[tile(0), tile(1)]} onSelect={onSelect} />);
  expect(within(container).getByText('Single Game')).toBeInTheDocument();
  expect(within(container).queryByText('Game 0')).not.toBeInTheDocument();
  expect(within(container).queryByText('Games')).not.toBeInTheDocument();
  expect(within(container).getByText('Plays').previousElementSibling).toHaveTextContent('8');
  expect(within(container).getByText('Players').previousElementSibling).toHaveTextContent('4');
  rerender(<PhotoGridCanvas {...props} stats={singleGameStats} tiles={[tile(0)]} />);
  expect(within(container).queryByText('Games')).not.toBeInTheDocument();
  expect(within(container).getByRole('button')).toBeDisabled();
  expect(container.querySelector('img')).toHaveAttribute('src', 'blob:photo-0');
  rerender(<PhotoGridCanvas {...props} tiles={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it.each([false, true])('omits shared dates only when the full recap is one day (single game: %s)', isSingleGame => {
  const tiles = [tile(0), tile(1)];
  const context = { ...props.context, isSingleGame, gameName: isSingleGame ? 'Single Game' : '', isSingleDay: true, dateLabel: '2026.10.01' };
  const { container } = render(<PhotoGridCanvas {...props} context={context} tiles={tiles} />);
  expect(within(container).getByText('2026.10.01')).toBeInTheDocument();
  const photos = within(container).getAllByRole('button');
  photos.forEach((photo, index) => {
    expect(within(photo).queryByText(formatGridDate(tiles[index].endTime))).not.toBeInTheDocument();
    expect(within(photo).queryByText(tiles[index].gameName) !== null).toBe(!isSingleGame);
  });
  expect(within(container).getByText('Photo selection · 2 games')).toBeInTheDocument();
});

it('shows per-photo years and full scope details without truncating a long shared title', () => {
  const title = 'A long game name that must remain readable in the exported recap';
  const tiles = [
    { ...tile(0), endTime: new Date(2025, 11, 31).getTime() },
    { ...tile(1), endTime: new Date(2026, 0, 1).getTime() },
  ];
  const { container } = render(<PhotoGridCanvas {...props} tiles={tiles}
    context={{ ...props.context, isSingleGame: true, gameName: title, includePhotoYear: true, dateLabel: '2025.12.31 — 2026.01.01' }}
    scopeLabel="Alice's recap" filters={['Co-op', '2 players']} />);
  expect(within(container).getByText(title)).not.toHaveClass('truncate');
  expect(within(container).getByText("Alice's recap · Co-op · 2 players")).toBeInTheDocument();
  within(container).getAllByRole('button').forEach((photo, index) => {
    expect(within(photo).getByText(formatGridDate(tiles[index].endTime, true))).toBeInTheDocument();
  });
});

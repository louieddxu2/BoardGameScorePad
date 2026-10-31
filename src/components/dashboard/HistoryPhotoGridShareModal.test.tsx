import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { LanguageProvider } from '../../i18n';
import { imageService } from '../../services/imageService';
import type { HistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import { buildHistoryPhotoRecapContext, type HistoryPhotoRecapSnapshot } from '../../utils/historyPhotoRecapContext';
import { formatGridDate } from './historyPhotoGridModel';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
vi.mock('../../services/imageService', () => ({ imageService: { getImage: vi.fn() } }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../hooks/useModalBackHandler', () => ({ useModalBackHandler: () => ({ zIndex: 100 }) }));
vi.mock('./historyPhotoGridModel', async importOriginal => ({
  ...await importOriginal<typeof import('./historyPhotoGridModel')>(),
  getImageSize: vi.fn(async () => ({ width: 1600, height: 900 })),
}));

const record = (id: string, endTime: number, extra: Partial<HistorySummary> = {}): HistorySummary => ({
  id, endTime, templateId: 'board', gameName: 'Game A',
  players: [{ id: 'alice', name: 'Alice', color: '#fff', totalScore: 1 }], winnerIds: [],
  firstPhotoId: `photo-${id}`, photoIds: [`photo-${id}`],
  _playerNames: '', _dateStr: '', _compactDate: '', _rocDate: '', ...extra,
});
const snapshot = (records: HistorySummary[]): HistoryPhotoRecapSnapshot => {
  const entries = buildHistoryGameEntries(records);
  return { entries, context: buildHistoryPhotoRecapContext(entries, records), filters: [] };
};
const view = (recap: HistoryPhotoRecapSnapshot | null) => (
  <LanguageProvider><HistoryPhotoGridShareModal recap={recap} onClose={vi.fn()} /></LanguageProvider>
);
const generate = () => screen.getByRole('button', { name: 'Generate Share Image' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('app_language', 'en');
  let nextUrl = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:photo-${++nextUrl}`) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.mocked(toBlob).mockResolvedValue(new Blob(['export'], { type: 'image/png' }));
  vi.mocked(imageService.getImage).mockImplementation(async id => ({
    id, blob: new Blob([id]), relatedId: id, relatedType: 'session', mimeType: 'image/jpeg', createdAt: 1,
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('photo recap sharing', () => {
  it.each(['zh-TW', 'en'])('shows shared game and day once, with localized selection text (%s)', async language => {
    localStorage.setItem('app_language', language);
    const gameName = 'A single game with a long name that should wrap without hiding the date';
    const records = [record('single', new Date(2026, 10, 1).getTime(), { gameName })];
    render(view(snapshot(records)));
    const generateLabel = language === 'en' ? 'Generate Share Image' : '產生分享圖片';
    await waitFor(() => expect(screen.getByRole('button', { name: generateLabel })).toBeEnabled());
    expect(screen.getAllByText(gameName)).toHaveLength(2);
    expect(screen.getAllByText('2026.11.01')).toHaveLength(2);
    expect(screen.getAllByText(language === 'en' ? 'Photo selection · 1 play' : '照片精選 · 1 場')).toHaveLength(2);
    const photoName = `${gameName} · ${formatGridDate(records[0].endTime, true)}`;
    screen.getAllByRole('button', { name: photoName }).forEach(button => expect(button.textContent).toBe(''));
  });

  it('selects up to eight distinct plays automatically and exports the same content as the preview', async () => {
    const records = Array.from({ length: 10 }, (_, index) => record(String(index), new Date(2026, 9, 1 + index).getTime()));
    const recap = snapshot(records);
    recap.playerName = 'Alice';
    recap.playerCountOverride = 3;
    recap.playerLabelOverride = 'Others';
    recap.filters = ['Co-op'];
    const { container } = render(view(recap));
    await waitFor(() => expect(generate()).toBeEnabled());
    expect(imageService.getImage).toHaveBeenCalledTimes(8);
    expect(screen.getAllByText('Photo selection · 8 plays')).toHaveLength(2);
    expect(screen.getAllByText("Alice's recap · Co-op")).toHaveLength(2);
    expect(screen.getAllByText('Others')).toHaveLength(2);
    expect(screen.getAllByText('Plays')[0].previousElementSibling).toHaveTextContent('10');
    const preview = container.querySelector('.grid')!.parentElement!;
    expect(within(preview).getAllByRole('button')).toHaveLength(8);

    fireEvent.click(generate());
    await waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
    const exported = vi.mocked(toBlob).mock.calls[0][0];
    expect(exported.textContent).toBe(preview.textContent);
    expect([...exported.querySelectorAll('img')].map(img => img.src)).toEqual([...preview.querySelectorAll('img')].map(img => img.src));
    expect(within(exported).getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true);
    expect(toBlob).toHaveBeenCalledWith(exported, { pixelRatio: 2, backgroundColor: 'rgb(var(--c-app-bg))', skipFonts: true });
  });

  it('keeps all scoped stats and dates when other games have no usable images', async () => {
    const records = [
      record('visible', new Date(2026, 10, 1).getTime()),
      record('missing', new Date(2025, 11, 20).getTime(), { gameName: 'Game B' }),
      record('without-photo', new Date(2025, 0, 1).getTime(), { gameName: 'Game C', firstPhotoId: undefined, photoIds: [] }),
    ];
    vi.mocked(imageService.getImage).mockImplementation(async id => id === 'photo-visible' ? {
      id, blob: new Blob([id]), relatedId: id, relatedType: 'session', mimeType: 'image/jpeg', createdAt: 1,
    } : undefined);
    const { container } = render(view(snapshot(records)));
    await waitFor(() => expect(generate()).toBeEnabled());
    expect(imageService.getImage).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('2025.01.01 — 2026.11.01')).toHaveLength(2);
    expect(screen.getAllByText('Games')[0].previousElementSibling).toHaveTextContent('3');
    const preview = container.querySelector('.grid')!.parentElement!;
    expect(within(preview).getByRole('button')).toHaveTextContent('Game A');
    expect(within(preview).getByRole('button')).toHaveTextContent(formatGridDate(records[0].endTime, true));
    expect(within(preview).getByText('Photo selection · 1 game')).toBeInTheDocument();
  });

  it('uses the replacement photo record date and preserves cropping through preview and export', async () => {
    const records = [
      record('first', new Date(2026, 9, 1).getTime(), { photoIds: ['photo-first', 'photo-alternate'] }),
      record('second', new Date(2026, 10, 1).getTime()),
      record('other', new Date(2026, 10, 2).getTime(), { gameName: 'Game B' }),
    ];
    const { container } = render(view(snapshot(records)));
    await waitFor(() => expect(generate()).toBeEnabled());
    const name = `Game A · ${formatGridDate(records[1].endTime, true)}`;
    const target = screen.getAllByRole('button', { name }).find(button => !button.hasAttribute('disabled'))!;
    fireEvent.click(target);
    await waitFor(() => expect(screen.getAllByTitle('Game A')).toHaveLength(3));
    // Candidate order is newest record first, then the earlier record's two photos.
    fireEvent.click(screen.getAllByTitle('Game A')[1]);
    const surface = container.querySelector<HTMLElement>('[data-mobile-zoom-ignore="true"]')!;
    vi.spyOn(surface.firstElementChild!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 225));
    fireEvent.wheel(surface, { deltaY: -500 });
    fireEvent.mouseDown(surface, { clientX: 200, clientY: 100 });
    fireEvent.mouseMove(surface, { clientX: 220, clientY: 100 });
    fireEvent.mouseUp(surface);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const preview = container.querySelector('.grid')!.parentElement!;
    const changed = within(preview).getByRole('button', { name: `Game A · ${formatGridDate(records[0].endTime, true)}` });
    expect(changed).toHaveTextContent(formatGridDate(records[0].endTime));
    expect(within(changed).getByRole('img')).toHaveStyle({ left: '55%', transform: 'translate(-50%, -50%) scale(1.5)' });
    fireEvent.click(generate());
    await waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
    const exported = vi.mocked(toBlob).mock.calls[0][0];
    expect(exported.textContent).toBe(preview.textContent);
    const exportedPhoto = within(exported).getByRole('button', { name: `Game A · ${formatGridDate(records[0].endTime, true)}` });
    expect(within(exportedPhoto).getByRole('img')).toHaveStyle({ left: '55%', transform: 'translate(-50%, -50%) scale(1.5)' });
  });

  it('does not reload photos on unrelated renders and refreshes the snapshot after reopening', async () => {
    const first = snapshot([record('first', new Date(2026, 10, 1).getTime())]);
    const next = snapshot([record('next', new Date(2026, 10, 2).getTime())]);
    const { rerender } = render(view(first));
    await waitFor(() => expect(generate()).toBeEnabled());
    rerender(view(first));
    expect(imageService.getImage).toHaveBeenCalledTimes(1);
    rerender(view(null));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    rerender(view(next));
    await waitFor(() => expect(generate()).toBeEnabled());
    expect(screen.getAllByText('2026.11.02')).toHaveLength(2);
    expect(imageService.getImage).toHaveBeenCalledTimes(2);
  });

  it('ignores a pending image load after closing and keeps the no-photo state when nothing loads', async () => {
    let finish!: (value: undefined) => void;
    vi.mocked(imageService.getImage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const recap = snapshot([record('pending', 1000)]);
    const { rerender } = render(view(recap));
    rerender(view(null));
    await act(async () => { finish(undefined); });
    vi.mocked(imageService.getImage).mockResolvedValue(undefined);
    rerender(view(recap));
    await waitFor(() => expect(screen.getByText('No history photos to share yet')).toBeInTheDocument());
    expect(generate()).toBeDisabled();
    expect(toBlob).not.toHaveBeenCalled();
  });
});

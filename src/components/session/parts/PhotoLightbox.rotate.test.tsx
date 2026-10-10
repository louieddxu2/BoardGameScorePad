import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { LanguageProvider } from '../../../i18n';
import { ToastProvider } from '../../../hooks/useToast';
import PhotoLightbox from './PhotoLightbox';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
vi.mock('../../../hooks/useModalBackHandler', () => ({
  useModalBackHandler: () => ({ triggerClose: vi.fn() }),
}));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('lightbox rotation control', () => {
  it('blocks duplicate rotations and regenerates scores from the new photo without a render loop', async () => {
    vi.useFakeTimers();
    let urlCount = 0;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:composed-${++urlCount}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.mocked(toBlob).mockImplementation(async node => new Blob([node.querySelector('img')!.src]));
    let finish!: () => void;
    const onRotate = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const overlayData = { gameName: 'Game', date: 1, players: [{ id: 'p', name: 'Player', color: '#fff', scores: {}, totalScore: 1 }], winners: [] };
    const view = (url: string) => (
      <LanguageProvider><ToastProvider><PhotoLightbox
        images={[{ id: 'photo', url }]} initialIndex={0} onClose={vi.fn()} onDelete={vi.fn()}
        onRotate={onRotate} overlayData={overlayData} initialShowOverlay manageBackHistory={false} />
      </ToastProvider></LanguageProvider>
    );
    const { rerender } = render(view('blob:original'));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    const rotate = screen.getByRole('button', { name: 'Rotate 90° clockwise' });
    expect(rotate).toBeEnabled();
    fireEvent.click(rotate);
    fireEvent.click(rotate);
    expect(onRotate).toHaveBeenCalledExactlyOnceWith('photo');
    expect(rotate).toBeDisabled();
    rerender(view('blob:rotated'));
    await act(async () => { finish(); });
    expect(rotate).toBeDisabled(); // Old composite must not become shareable.
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(rotate).toBeEnabled();
    expect(screen.getByAltText('Full view')).toHaveAttribute('src', 'blob:composed-2');
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(toBlob).toHaveBeenCalledTimes(2);
  });
});

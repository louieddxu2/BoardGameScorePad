import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageService } from '../../services/imageService';
import HistoryPhotoStrip from './HistoryPhotoStrip';

vi.mock('../../services/imageService', () => ({
    imageService: {
        getImage: vi.fn(),
    },
}));

describe('HistoryPhotoStrip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn((blob: Blob) => `blob:${blob.size}`),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn(),
        });
    });

    it('shows available photos newest first and opens the selected photo', async () => {
        vi.mocked(imageService.getImage).mockImplementation(async id => {
            if (id === 'missing') return undefined;
            return {
                id,
                relatedId: 'history-1',
                relatedType: 'session',
                blob: new Blob([id], { type: 'image/jpeg' }),
                mimeType: 'image/jpeg',
                createdAt: 1,
            };
        });
        const onPhotoClick = vi.fn();

        render(
            <HistoryPhotoStrip
                photoIds={['oldest', 'missing', 'newest-photo']}
                onPhotoClick={onPhotoClick}
            />,
        );

        await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
        const buttons = screen.getAllByRole('button');
        expect(vi.mocked(imageService.getImage).mock.calls.map(([id]) => id)).toEqual([
            'newest-photo',
            'missing',
            'oldest',
        ]);

        fireEvent.click(buttons[0]);
        expect(onPhotoClick).toHaveBeenCalledWith('newest-photo');
    });

    it('keeps the row absent when no local photo can be loaded', async () => {
        vi.mocked(imageService.getImage).mockResolvedValue(undefined);
        const { container } = render(
            <HistoryPhotoStrip photoIds={['missing']} onPhotoClick={vi.fn()} />,
        );

        await waitFor(() => expect(imageService.getImage).toHaveBeenCalled());
        expect(container.querySelector('[data-history-photo-strip="true"]')).not.toBeInTheDocument();
    });
});

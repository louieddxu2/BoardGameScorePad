import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { imageService } from '../../../services/imageService';
import PhotoGalleryModal from './PhotoGalleryModal';

const mocks = vi.hoisted(() => ({
    lightboxProps: vi.fn(),
    backHandler: vi.fn(() => ({ zIndex: 100, triggerClose: vi.fn() })),
}));

vi.mock('../../../services/imageService', () => ({
    imageService: { getImage: vi.fn() },
}));
vi.mock('../../../hooks/useConfirm', () => ({
    useConfirm: () => ({ confirm: vi.fn() }),
}));
vi.mock('../../../hooks/useModalBackHandler', () => ({
    useModalBackHandler: mocks.backHandler,
}));
vi.mock('../parts/PhotoLightbox', () => ({
    default: (props: unknown) => {
        mocks.lightboxProps(props);
        return <div data-testid="photo-lightbox" />;
    },
}));

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    photoIds: ['oldest', 'middle', 'newest'],
    onUploadPhoto: vi.fn(),
    onTakePhoto: vi.fn(),
    onDeletePhoto: vi.fn(),
};

describe('PhotoGalleryModal entry modes', () => {
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
        vi.mocked(imageService.getImage).mockImplementation(async id => ({
            id,
            relatedId: 'history-1',
            relatedType: 'session',
            blob: new Blob([id], { type: 'image/jpeg' }),
            mimeType: 'image/jpeg',
            createdAt: 1,
        }));
    });

    it('uses one history layer and opens the requested image for direct entry', async () => {
        render(
            <LanguageProvider>
                <PhotoGalleryModal
                    {...defaultProps}
                    entryMode="direct-lightbox"
                    initialPhotoId="middle"
                />
            </LanguageProvider>,
        );

        await waitFor(() => expect(mocks.lightboxProps).toHaveBeenCalled());
        expect(mocks.backHandler).toHaveBeenCalledWith(
            true,
            defaultProps.onClose,
            'photo-direct-lightbox',
        );
        expect(mocks.lightboxProps).toHaveBeenLastCalledWith(
            expect.objectContaining({
                initialIndex: 1,
                manageBackHistory: false,
                images: expect.arrayContaining([
                    expect.objectContaining({ id: 'middle' }),
                ]),
            }),
        );
    });

    it('keeps the existing gallery history layer in normal entry mode', () => {
        render(
            <LanguageProvider>
                <PhotoGalleryModal {...defaultProps} />
            </LanguageProvider>,
        );

        expect(mocks.backHandler).toHaveBeenCalledWith(
            true,
            defaultProps.onClose,
            'photo-gallery',
        );
        expect(mocks.lightboxProps).not.toHaveBeenCalled();
    });
});

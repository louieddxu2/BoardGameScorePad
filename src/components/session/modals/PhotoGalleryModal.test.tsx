import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { imageService } from '../../../services/imageService';
import PhotoGalleryModal from './PhotoGalleryModal';
import { rotatePhotoBlob } from '../../../utils/photoRotation';

const mocks = vi.hoisted(() => ({
    lightboxProps: vi.fn(),
    backHandler: vi.fn((_isOpen: boolean, _onClose: () => void, _id: string) => ({ zIndex: 100, triggerClose: vi.fn() })),
}));

vi.mock('../../../services/imageService', () => ({
    imageService: { getImage: vi.fn() },
}));
vi.mock('../../../utils/photoRotation', async importOriginal => ({
    ...await importOriginal<typeof import('../../../utils/photoRotation')>(),
    rotatePhotoBlob: vi.fn(async (blob: Blob) => blob),
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
        vi.mocked(rotatePhotoBlob).mockImplementation(async blob => blob);
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

    it('keeps the existing gallery history layer in normal entry mode', async () => {
        render(
            <LanguageProvider>
                <PhotoGalleryModal {...defaultProps} />
            </LanguageProvider>,
        );

        await waitFor(() => expect(screen.getAllByRole('img', { name: 'Session Photo' })).toHaveLength(3));
        expect(mocks.backHandler).toHaveBeenCalledWith(
            true,
            defaultProps.onClose,
            'photo-gallery',
        );
        expect(mocks.lightboxProps).not.toHaveBeenCalled();
    });

    it('saves through the latest owner callback without leaving the selected photo or adding a history layer', async () => {
        let finish!: (blob: Blob) => void;
        const originalSave = vi.fn();
        const latestSave = vi.fn();
        const view = (onRotatePhoto: typeof originalSave) => (
            <LanguageProvider><PhotoGalleryModal {...defaultProps}
                entryMode="direct-lightbox" initialPhotoId="middle" onRotatePhoto={onRotatePhoto} />
            </LanguageProvider>
        );
        const { rerender } = render(view(originalSave));
        await waitFor(() => expect(mocks.lightboxProps).toHaveBeenCalled());
        vi.mocked(rotatePhotoBlob).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        let pending!: Promise<void>;
        act(() => { pending = mocks.lightboxProps.mock.lastCall![0].onRotate('middle'); });
        rerender(view(latestSave));
        await act(async () => { finish(new Blob(['rotated-middle'])); await pending; });
        expect(originalSave).not.toHaveBeenCalled();
        expect(latestSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'middle', blob: expect.any(Blob), contentId: expect.any(String) }), undefined);
        expect(mocks.lightboxProps.mock.lastCall![0]).toMatchObject({ initialIndex: 1, manageBackHistory: false });
        expect(mocks.lightboxProps.mock.lastCall![0].images[1]).toMatchObject({ id: 'middle', url: 'blob:14', contentId: expect.any(String) });
        expect(new Set(mocks.backHandler.mock.calls.map(call => call[2]))).toEqual(new Set(['photo-direct-lightbox']));
        expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
});

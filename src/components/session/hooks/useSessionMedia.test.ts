import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { GameSession, GameTemplate } from '../../../types';
import { BackupInProgressError, withBackupAccess } from '../../../services/backupAccess';
import { useSessionMedia } from './useSessionMedia';

const mocks = vi.hoisted(() => ({
    downloadCloudImage: vi.fn<(fileId: string, signal?: AbortSignal) => Promise<Blob | null>>(),
    connectToCloud: vi.fn<() => Promise<boolean>>(),
    isConnected: true,
}));

vi.mock('../../../hooks/useGoogleDrive', () => ({ useGoogleDrive: () => ({
    downloadCloudImage: mocks.downloadCloudImage,
    connectToCloud: mocks.connectToCloud,
    isAutoConnectEnabled: true,
    isConnected: mocks.isConnected,
}) }));
vi.mock('../../../services/googleDrive', () => ({ googleDriveService: { isAuthorized: true } }));
vi.mock('../../../hooks/usePhotoManager', () => ({ usePhotoManager: () => ({}) }));
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../../i18n/session', () => ({ useSessionTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../i18n/common', () => ({ useCommonTranslation: () => ({ t: (key: string) => key }) }));

const session: GameSession = { id: 'play', templateId: 'board', name: 'Board', startTime: 1, status: 'active', players: [] };
const template: GameTemplate = { id: 'board', name: 'Board', createdAt: 1, columns: [], hasImage: true, cloudImageId: 'drive-image' };

const setup = (baseImage: string | null, onUpdateImage = vi.fn()) => {
    const setUiState = vi.fn();
    const view = renderHook(() => useSessionMedia({
        session, template, baseImage, onUpdateImage, setUiState, isEditMode: false,
        onUpdateSession: vi.fn(), onUpdateTemplate: vi.fn(),
    }));
    return { ...view, onUpdateImage, setUiState };
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.isConnected = true;
});

it.each(['automatic', 'manual'] as const)('aborts a pending %s download on exit and ignores late image data', async mode => {
    let finishDownload!: (blob: Blob) => void;
    mocks.downloadCloudImage.mockReturnValueOnce(new Promise(resolve => { finishDownload = resolve; }));
    const view = setup(mode === 'automatic' ? null : 'blob:existing');
    const manual = mode === 'manual' ? view.result.current.handleCloudDownload() : undefined;
    const signal = mocks.downloadCloudImage.mock.calls[0][1]!;
    expect(mocks.downloadCloudImage).toHaveBeenCalledExactlyOnceWith('drive-image', signal);
    view.rerender();
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
        finishDownload(new Blob(['late image']));
        await manual;
    });
    expect(view.onUpdateImage).not.toHaveBeenCalled();
    expect(view.setUiState).not.toHaveBeenCalled();
});

it('does not start a manual download if the session closes during Drive sign-in', async () => {
    mocks.isConnected = false;
    let finishSignIn!: (connected: boolean) => void;
    mocks.connectToCloud.mockReturnValueOnce(new Promise(resolve => { finishSignIn = resolve; }));
    const view = setup('blob:existing');
    const manual = view.result.current.handleCloudDownload();
    expect(mocks.connectToCloud).toHaveBeenCalledTimes(1);
    view.unmount();
    finishSignIn(true);
    await manual;
    expect(mocks.downloadCloudImage).not.toHaveBeenCalled();
});

it('blocks ZIP restore until the downloaded image has been saved', async () => {
    const blob = new Blob(['cloud image']);
    mocks.downloadCloudImage.mockResolvedValueOnce(blob);
    let finishWrite!: () => void;
    const write = vi.fn(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const view = setup('blob:existing', write);
    const manual = view.result.current.handleCloudDownload();
    const restore = vi.fn(async () => {});
    try {
        await waitFor(() => expect(write).toHaveBeenCalledExactlyOnceWith(blob));
        view.unmount();
        await expect(withBackupAccess('zip', restore)).rejects.toBeInstanceOf(BackupInProgressError);
    } finally {
        finishWrite?.();
        await manual;
    }
    await withBackupAccess('zip', restore);
    expect(restore).toHaveBeenCalledTimes(1);
});

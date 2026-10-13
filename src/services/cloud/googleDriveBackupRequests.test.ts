import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession, GameTemplate, HistoryRecord } from '../../types';
import { db } from '../../db';
import { googleDriveService } from '../googleDrive';
import { systemSyncService } from '../systemSyncService';
import { imageService } from '../imageService';
import { googleDriveClient } from './googleDriveClient';

vi.mock('../../db', () => ({ db: { sessions: { get: vi.fn() }, history: { get: vi.fn() },
    templates: { get: vi.fn() }, builtins: { get: vi.fn() } } }));
vi.mock('./googleAuth', () => ({ googleAuth: { isAuthorized: true, token: 'test-token', signOut: vi.fn() } }));
vi.mock('../imageService', () => ({ imageService: { getImage: vi.fn() } }));

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const jsonFile = { id: 'json-file', name: 'session.json', mimeType: 'application/json' };
const image = { contentId: 'v2', mimeType: 'image/jpeg',
    blob: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob };
const record: HistoryRecord = {
    id: 'play', templateId: 'template', gameName: 'Game', startTime: 1, endTime: 2, updatedAt: 2,
    players: [], winnerIds: [], photos: [],
    snapshotTemplate: { id: 'template', name: 'Game', columns: [], createdAt: 1 },
};
const template: GameTemplate = { id: 'template', name: 'Game', columns: [], createdAt: 1,
    updatedAt: 2, imageId: 'replacement', cloudImageId: 'old-image' };

const acceptBackupRequests = (files: Array<{ id: string; name: string; mimeType: string }>): typeof fetch => {
    let created = 0;
    return async (input, options) => {
        const url = new URL(String(input));
        if (url.pathname === '/drive/v3/files') return json({ files });
        if (url.pathname.startsWith('/upload/drive/v3/files')) {
            return json({ id: options?.method === 'POST' ? `uploaded-${++created}` : url.pathname.split('/').pop(),
                parents: ['folder'], trashed: false });
        }
        if (options?.method === 'PATCH') return json({ id: url.pathname.split('/').pop() });
        throw new Error(`Unexpected test request: ${url.pathname}`);
    };
};

const settings = () => ({
    schemaVersion: 2, timestamp: 1,
    preferences: { theme: 'dark', pinned: ['template'] },
    library: { players: [{ name: 'Alice', usageCount: 1 }], locations: [] },
    system: { bggGames: [], templatePrefs: [], sessionContextWeights: { player: 1 } },
});
const acceptSettingsRequests = (remote: ReturnType<typeof settings> | undefined): typeof fetch =>
    async (input, options) => {
        const url = new URL(String(input));
        if (url.pathname === '/drive/v3/files') {
            return json({ files: remote ? [{ id: 'settings-file' }] : [] });
        }
        if (url.searchParams.get('alt') === 'media') return json(remote);
        if (url.pathname.startsWith('/upload/drive/v3/files')) return json({ id: 'settings-file', parents: ['system'], trashed: false });
        throw new Error(`Unexpected test request: ${options?.method || 'GET'} ${url.pathname}`);
    };

describe('backup API request budgets and recovery', () => {
    beforeEach(async () => {
        vi.resetAllMocks();
        vi.stubGlobal('fetch', fetchMock);
        await googleDriveService.signOut();
        Object.assign(googleDriveService, { systemFolderId: 'system', templatesFolderId: 'templates',
            activeFolderId: 'active', historyFolderId: 'history' });
        vi.spyOn(googleDriveService, 'ensureAppStructure').mockResolvedValue();
        for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
        vi.mocked(imageService.getImage).mockResolvedValue(image as any);
        vi.mocked(db.history.get).mockResolvedValue(record);
        vi.mocked(db.templates.get).mockResolvedValue(template);
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it.each(['active', 'history'] as const)('backs up ten new %s photos and combines rename with metadata in thirteen requests', async kind => {
        const photos = Array.from({ length: 10 }, (_, index) => `photo-${index}`);
        const photoContentIds = Object.fromEntries(photos.map(id => [id, 'v2']));
        const edited = { ...record, photos, photoContentIds };
        const active: GameSession = { ...edited, name: 'Game', status: 'active', lastUpdatedAt: 2 };
        vi.mocked(db.history.get).mockResolvedValue(edited);
        vi.mocked(db.sessions.get).mockResolvedValue(active);
        fetchMock.mockImplementation(acceptBackupRequests([jsonFile]));
        const result = kind === 'history'
            ? await googleDriveService.backupHistoryRecord(edited, 'folder', 'Old_play')
            : await googleDriveService.backupActiveSession(active, 'Game', 'folder', 'Old_play');
        expect(fetchMock).toHaveBeenCalledTimes(13);
        const calls = fetchMock.mock.calls;
        expect(calls.filter(([input]) => new URL(String(input)).pathname === '/drive/v3/files')).toHaveLength(1);
        expect(calls.filter(([input]) => String(input).includes('/upload/'))).toHaveLength(11);
        expect(calls[11][0]).toContain('/upload/drive/v3/files/json-file');
        expect(JSON.parse(calls[12][1]!.body as string)).toEqual({
            name: 'Game_play', appProperties: { localUuid: 'play', originalUpdatedAt: '2' },
        });
        const saved = result && ('updatedRecord' in result ? result.updatedRecord : result.updatedSession);
        expect(Object.keys(saved!.photoCloudIds!)).toHaveLength(10);
    });

    it('reuses a versioned photo from the listing when its saved cloud-ID map is missing', async () => {
        const edited = { ...record, photos: ['photo'], photoContentIds: { photo: 'v2' } };
        vi.mocked(db.history.get).mockResolvedValue(edited);
        fetchMock.mockImplementation(acceptBackupRequests([jsonFile,
            { id: 'photo-v2', name: 'photo_v2.jpg', mimeType: 'image/jpeg' },
            { id: 'other-device-v3', name: 'photo_v3.jpg', mimeType: 'image/jpeg' },
        ]));
        const result = await googleDriveService.backupHistoryRecord(edited, 'folder');
        expect(result?.updatedRecord.photoCloudIds).toEqual({ 'photo@v2': 'photo-v2' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(imageService.getImage).not.toHaveBeenCalled();
        expect(fetchMock.mock.calls.some(([, init]) => String(init?.body).includes('"trashed"'))).toBe(false);
    });

    it('reads every listing page before resolving the JSON ID', async () => {
        const normal = acceptBackupRequests([jsonFile]);
        fetchMock.mockImplementation(async (input, init) => {
            const url = new URL(String(input));
            if (url.pathname === '/drive/v3/files' && !url.searchParams.has('pageToken')) {
                return json({ files: [], nextPageToken: 'page-2' });
            }
            return normal(input, init);
        });
        await googleDriveService.backupHistoryRecord(record, 'folder');
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');
        expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/json-file');
        expect(fetchMock.mock.calls[2][1]?.method).toBe('PATCH');
    });

    it('falls back to a file search instead of treating an incomplete folder listing as empty', async () => {
        fetchMock.mockImplementationOnce(async () => json({ files: [], incompleteSearch: true }))
            .mockImplementation(acceptBackupRequests([jsonFile]));
        await googleDriveService.backupHistoryRecord(record, 'folder');
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('q')).toContain("name = 'session.json'");
        expect(fetchMock.mock.calls[2][1]?.method).toBe('PATCH');
    });

    it('refreshes an invalid upload ID once without blindly creating a duplicate', async () => {
        fetchMock.mockImplementationOnce(async () => json({ error: { message: 'Gone' } }, 404))
            .mockImplementation(acceptBackupRequests([{ ...jsonFile, id: 'replacement-json' }]));
        await googleDriveClient.uploadFileToFolder('folder', 'session.json', 'application/json', '{}', 'stale-json');
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/replacement-json');
        expect(fetchMock.mock.calls[2][1]?.method).toBe('PATCH');
    });

    it('completes a paginated JSON absence recheck before choosing update versus create', async () => {
        fetchMock.mockResolvedValueOnce(json({ files: [], nextPageToken: 'page-2' }))
            .mockResolvedValueOnce(json({ files: [jsonFile] }))
            .mockImplementation(acceptBackupRequests([jsonFile]));
        await googleDriveClient.uploadFileToFolder('folder', 'session.json', 'application/json', '{}', null);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');
        expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/json-file');
        expect(fetchMock.mock.calls[2][1]?.method).toBe('PATCH');
    });

    it('does not create JSON from an incomplete absence recheck', async () => {
        fetchMock.mockResolvedValue(json({ files: [], incompleteSearch: true }));
        await expect(googleDriveClient.uploadFileToFolder('folder', 'session.json', 'application/json', '{}', null))
            .rejects.toThrow('incomplete');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each(['permission', 'network'] as const)('does not search or create a replacement after a %s upload error', async kind => {
        if (kind === 'permission') fetchMock.mockResolvedValue(json({ error: { message: 'Forbidden' } }, 403));
        else fetchMock.mockRejectedValue(new Error('Offline'));
        await expect(googleDriveClient.uploadFileToFolder('folder', 'session.json', 'application/json', '{}', 'known-json'))
            .rejects.toThrow(kind === 'permission' ? 'Forbidden' : 'Offline');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('preserves find-or-create for callers without a listing hint', async () => {
        fetchMock.mockImplementation(acceptBackupRequests([jsonFile]));
        await googleDriveClient.uploadFileToFolder('folder', 'session.json', 'application/json', '{}');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH');
    });

    it('shares a template listing and cleans replaced images only after JSON and combined metadata commit', async () => {
        fetchMock.mockImplementation(acceptBackupRequests([
            { ...jsonFile, name: 'data.json' }, { id: 'old-image', name: 'old.jpg', mimeType: 'image/jpeg' },
        ]));
        const updated = await googleDriveService.backupTemplate(template, null, 'folder', 'Old_template');
        expect(updated?.cloudImageId).toBe('uploaded-1');
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/json-file');
        expect(JSON.parse(fetchMock.mock.calls[3][1]!.body as string)).toEqual({
            name: 'Game_template', appProperties: { localUuid: 'template', originalUpdatedAt: '2' },
        });
        expect(JSON.parse(fetchMock.mock.calls[4][1]!.body as string)).toEqual({ trashed: true });
    });

    it.each(['json', 'metadata'] as const)('retains old template images if the %s commit fails', async stage => {
        const normal = acceptBackupRequests([
            { ...jsonFile, name: 'data.json' }, { id: 'old-image', name: 'old.jpg', mimeType: 'image/jpeg' },
        ]);
        fetchMock.mockImplementation(async (input, init) => {
            const path = new URL(String(input)).pathname;
            if (path === (stage === 'json' ? '/upload/drive/v3/files/json-file' : '/drive/v3/files/folder')) {
                return json({ error: { message: 'Commit failed' } }, 500);
            }
            return normal(input, init);
        });
        await expect(googleDriveService.backupTemplate(template, null, 'folder', 'Old_template')).rejects.toThrow('Commit failed');
        expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/old-image'))).toBe(false);
    });

    it('merges cloud-only settings and updates the originally read ID in three requests', async () => {
        const remote = settings();
        remote.library.players.push({ name: 'Cloud only', usageCount: 2 });
        const local = settings();
        local.preferences.theme = 'light';
        fetchMock.mockImplementation(acceptSettingsRequests(remote));
        const upload = vi.spyOn(googleDriveClient, 'uploadFileToFolder');
        expect(await systemSyncService.mergeAndBackupSystemSettings(local)).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/settings-file');
        expect(JSON.parse(upload.mock.calls[0][3] as string).library.players).toEqual(remote.library.players);
    });

    it('skips unchanged settings in two requests despite key order, absent undefined values and backup timestamp differences', async () => {
        const remote = settings();
        const local = { ...settings(), timestamp: 99,
            preferences: { pinned: ['template'], theme: 'dark', unused: undefined } };
        fetchMock.mockImplementation(acceptSettingsRequests(remote));
        expect(await systemSyncService.mergeAndBackupSystemSettings(local)).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
    });

    it('rechecks missing settings before creating them without overwriting another device', async () => {
        fetchMock.mockImplementation(acceptSettingsRequests(undefined));
        expect(await systemSyncService.mergeAndBackupSystemSettings(settings())).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][1]?.method).toBe('POST');
    });

    it('does not overwrite settings after a failed download', async () => {
        const normal = acceptSettingsRequests(settings());
        fetchMock.mockImplementation((input, init) => new URL(String(input)).searchParams.get('alt') === 'media'
            ? Promise.resolve(json({ error: { message: 'Unavailable' } }, 503)) : normal(input, init));
        await expect(systemSyncService.mergeAndBackupSystemSettings(settings())).rejects.toThrow('Unavailable');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not apply an already merged settings payload to a replacement file after a stale-ID error', async () => {
        const normal = acceptSettingsRequests(settings());
        const local = settings();
        local.preferences.theme = 'light';
        fetchMock.mockImplementation((input, init) => String(input).includes('/upload/')
            ? Promise.resolve(json({ error: { message: 'Settings replaced' } }, 404)) : normal(input, init));
        await expect(systemSyncService.mergeAndBackupSystemSettings(local)).rejects.toThrow('Settings replaced');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const enableInitialization = () => {
        vi.mocked(googleDriveService.ensureAppStructure).mockRestore();
        Object.assign(googleDriveService, { systemFolderId: null, templatesFolderId: null,
            activeFolderId: null, historyFolderId: null });
    };
    const appFolders = ['_System', '_Active', '_History', '_Templates'].map(name => ({
        id: `new${name}`, name, mimeType: 'application/vnd.google-apps.folder',
    }));
    const acceptInitialization: typeof fetch = async input => {
        const query = new URL(String(input)).searchParams.get('q') || '';
        return json({ files: query.includes("name = 'BoardGameScorePad'") ? [{ id: 'new-root' }] : appFolders });
    };

    it('shares concurrent initialization and resolves four existing directories with two requests including the root', async () => {
        enableInitialization();
        fetchMock.mockImplementation(acceptInitialization);
        await Promise.all(Array.from({ length: 3 }, () => googleDriveService.ensureAppStructure()));
        await googleDriveService.ensureAppStructure();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(googleDriveService.templatesFolderId).toBe('new_Templates');
        expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('q')).toContain("'_System'");
    });

    it('creates only a genuinely missing system directory after the shared lookup', async () => {
        enableInitialization();
        fetchMock.mockImplementation(async (input, init) => {
            if (init?.method === 'POST') return json({ id: 'created-templates' });
            const query = new URL(String(input)).searchParams.get('q') || '';
            if (query.includes("name = 'BoardGameScorePad'")) return json({ files: [{ id: 'new-root' }] });
            return json({ files: appFolders.filter(folder => folder.name !== '_Templates') });
        });
        await googleDriveService.ensureAppStructure();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string)).toEqual({
            name: '_Templates', mimeType: 'application/vnd.google-apps.folder', parents: ['new-root'],
        });
        expect(googleDriveService.templatesFolderId).toBe('created-templates');
    });

    it('does not create directories from an incomplete listing and releases failed initialization for retry', async () => {
        enableInitialization();
        fetchMock.mockImplementationOnce(async () => json({ files: [{ id: 'new-root' }] }))
            .mockImplementationOnce(async () => json({ files: [appFolders[0]], incompleteSearch: true }))
            .mockImplementation(acceptInitialization);
        await expect(googleDriveService.ensureAppStructure()).rejects.toThrow('incomplete');
        expect(googleDriveService.systemFolderId).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await googleDriveService.ensureAppStructure();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(googleDriveService.systemFolderId).toBe('new_System');
    });

    it('rejects an old initialization after logout without overwriting the new connection root or folders', async () => {
        enableInitialization();
        let releaseOld!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { releaseOld = resolve; }))
            .mockImplementation(acceptInitialization);
        const pending = googleDriveService.ensureAppStructure();
        const rejected = expect(pending).rejects.toThrow('Drive connection changed');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        await googleDriveService.signOut();
        await googleDriveService.ensureAppStructure();
        releaseOld(json({ files: [{ id: 'old-root' }] }));
        await rejected;
        expect(googleDriveService.systemFolderId).toBe('new_System');
        fetchMock.mockImplementationOnce(async () => json({ files: [{ id: 'trash' }] }))
            .mockImplementationOnce(async () => json({ files: [] }));
        await googleDriveService.emptyTrash('template');
        const trashLookup = new URL(String(fetchMock.mock.calls[3][0])).searchParams.get('q');
        expect(trashLookup).toContain("'new-root' in parents");
        expect(trashLookup).not.toContain("'old-root' in parents");
    });

    it('groups all three backup categories by parent ID across a merged paginated query', async () => {
        const folder = (id: string, parent: string) => ({ id, name: `Game_${id}`, createdTime: '', parents: [parent] });
        fetchMock.mockResolvedValueOnce(json({ files: [folder('t', 'templates'), folder('h', 'history')], nextPageToken: 'page-2' }))
            .mockResolvedValueOnce(json({ files: [folder('s', 'active')] }));
        const groups = await googleDriveService.listBackupFolders();
        expect(groups.templates.map(file => file.id)).toEqual(['t']);
        expect(groups.history.map(file => file.id)).toEqual(['h']);
        expect(groups.active.map(file => file.id)).toEqual(['s']);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const query = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('q');
        for (const parent of ['templates', 'history', 'active']) expect(query).toContain(`'${parent}' in parents`);
    });

    it('rejects a grouped listing without parent metadata instead of silently dropping records', async () => {
        fetchMock.mockResolvedValue(json({ files: [{ id: 'folder', name: 'Game_play' }] }));
        await expect(googleDriveService.listBackupFolders()).rejects.toThrow('parent is missing');
    });
});

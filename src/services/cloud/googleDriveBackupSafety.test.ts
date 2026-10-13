import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate } from '../../types';
import { db } from '../../db';
import { googleDriveService } from '../googleDrive';
import { imageService } from '../imageService';
import { systemSyncService } from '../systemSyncService';

vi.mock('../../db', () => ({ db: {
    templates: { get: vi.fn() }, builtins: { get: vi.fn() },
} }));
vi.mock('./googleAuth', () => ({ googleAuth: {
    isAuthorized: true, token: 'test-token', signOut: vi.fn(),
} }));
vi.mock('../imageService', () => ({ imageService: { getImage: vi.fn() } }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const image = { mimeType: 'image/jpeg',
    blob: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob };
const template: GameTemplate = { id: 'template', name: 'Game', columns: [], createdAt: 1,
    updatedAt: 3, imageId: 'new-image', cloudImageId: 'old-image' };

interface StoredFile {
    id: string;
    name: string;
    mimeType: string;
    parents: string[];
    trashed: boolean;
    content?: any;
    appProperties?: Record<string, string>;
}

/** Stateful transport: PATCH preserves parents/trash, as Drive does for omitted fields. */
const fakeDrive = () => {
    const files = new Map<string, StoredFile>();
    let nextId = 0;
    const put = (id: string, name: string, mimeType: string, parent = 'folder', content?: any) => {
        const file = { id, name, mimeType, parents: [parent], trashed: false, content };
        files.set(id, file);
        return file;
    };
    put('folder', 'Game_template', 'application/vnd.google-apps.folder', 'templates');
    put('old-image', 'old.jpg', 'image/jpeg');
    const visibleJson = () => [...files.values()].filter(file =>
        file.name === 'data.json' && file.parents.includes('folder') && !file.trashed);
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === '/drive/v3/files') {
            const query = url.searchParams.get('q') || '';
            const parent = query.match(/'([^']+)' in parents/)?.[1];
            const name = query.match(/name = '([^']+)'/)?.[1];
            const mimeType = query.match(/mimeType = '([^']+)'/)?.[1];
            return json({ files: [...files.values()].filter(file => !file.trashed &&
                (!parent || file.parents.includes(parent)) && (!name || file.name === name) &&
                (!mimeType || file.mimeType === mimeType)) });
        }
        const id = url.pathname.split('/').pop()!;
        if (url.pathname.startsWith('/upload/drive/v3/files')) {
            const boundary = (init!.headers as Record<string, string>)['Content-Type'].split('boundary=')[1];
            const parts = new TextDecoder().decode(init!.body as Uint8Array).split(`--${boundary}`);
            const metadata = JSON.parse(parts[1].split('\r\n\r\n')[1].trim());
            const file = init!.method === 'POST'
                ? put(`created-${++nextId}`, metadata.name, metadata.mimeType, metadata.parents[0])
                : files.get(id);
            if (!file) return json({ error: { message: 'Not found' } }, 404);
            Object.assign(file, metadata);
            if (metadata.mimeType === 'application/json') {
                file.content = JSON.parse(parts[2].split('\r\n\r\n')[1].trim());
            }
            return json(file);
        }
        const file = files.get(id);
        if (!file) return json({ error: { message: 'Not found' } }, 404);
        if (url.searchParams.get('alt') === 'media') return json(file.content);
        if (init?.method === 'PATCH') {
            Object.assign(file, JSON.parse(init.body as string));
            return json(file);
        }
        throw new Error(`Unexpected request: ${init?.method || 'GET'} ${url.pathname}`);
    });
    return { files, put, visibleJson, fetch };
};

describe('backup races and commit safety', () => {
    let drive: ReturnType<typeof fakeDrive>;
    let latest: GameTemplate | undefined;
    let pending: Promise<unknown>[];
    let releaseImage: (() => void) | undefined;

    beforeEach(async () => {
        vi.resetAllMocks();
        await googleDriveService.signOut();
        Object.assign(googleDriveService, { systemFolderId: 'system', templatesFolderId: 'templates',
            activeFolderId: 'active', historyFolderId: 'history' });
        drive = fakeDrive();
        vi.stubGlobal('fetch', drive.fetch);
        latest = { ...template };
        pending = [];
        releaseImage = undefined;
        vi.mocked(db.templates.get).mockImplementation(() => Promise.resolve(latest) as ReturnType<typeof db.templates.get>);
        vi.mocked(imageService.getImage).mockResolvedValue(image as any);
        for (const method of ['log', 'warn', 'error'] as const) {
            vi.spyOn(console, method).mockImplementation(() => {});
        }
    });
    afterEach(async () => {
        releaseImage?.();
        await Promise.allSettled(pending);
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const pauseFirstImage = () => {
        vi.mocked(imageService.getImage).mockImplementationOnce(() => new Promise(resolve => {
            releaseImage = () => resolve(image as any);
        }));
    };
    const backup = (snapshot = template) => {
        const task = googleDriveService.backupTemplate(snapshot, null, 'folder');
        pending.push(task);
        return task;
    };
    const waitForImage = () => vi.waitFor(() => expect(imageService.getImage).toHaveBeenCalledTimes(1));

    it('refreshes cached absence after photo upload and updates JSON created meanwhile by another device', async () => {
        pauseFirstImage();
        const task = backup();
        await waitForImage();
        drive.put('other-device-json', 'data.json', 'application/json', 'folder', { ...template, updatedAt: 2 });
        releaseImage!();
        await task;
        expect(drive.visibleJson()).toMatchObject([{ id: 'other-device-json', content: { updatedAt: 3 } }]);
        expect((await googleDriveService.getFileContent('folder')).updatedAt).toBe(3);
        const jsonUploads = drive.fetch.mock.calls.filter(([input]) => String(input).includes('/upload/') &&
            String(input).includes('other-device-json'));
        expect(jsonUploads).toHaveLength(1);
        expect(jsonUploads[0][1]?.method).toBe('PATCH');
    });

    it('serializes template backups and rereads the queued source instead of writing a captured older version last', async () => {
        latest = { ...template, updatedAt: 2 };
        pauseFirstImage();
        const first = backup(latest);
        await waitForImage();
        latest = { ...template, name: 'Newest', imageId: 'newer-image' };
        const queued = backup({ ...template, updatedAt: 2 });
        await Promise.resolve();
        expect(db.templates.get).toHaveBeenCalledTimes(1); // Queued work must not capture the source yet.
        expect(drive.fetch).toHaveBeenCalledTimes(1); // Second backup has not listed/uploaded anything.
        releaseImage!();
        await Promise.all([first, queued]);
        expect(drive.visibleJson()).toMatchObject([{ content: { name: 'Newest', updatedAt: 3, imageId: 'newer-image' } }]);
        expect((await googleDriveService.getFileContent('folder')).name).toBe('Newest');
    });

    it('does not commit JSON, metadata or image cleanup after a template is deleted during image upload', async () => {
        drive.put('json', 'data.json', 'application/json', 'folder', { ...template, updatedAt: 2 });
        pauseFirstImage();
        const task = backup();
        await waitForImage();
        latest = undefined;
        releaseImage!();
        expect(await task).toBeNull();
        expect(drive.visibleJson()[0].content.updatedAt).toBe(2);
        expect(drive.files.get('folder')!.appProperties).toBeUndefined();
        expect(drive.files.get('old-image')!.trashed).toBe(false);
        expect(drive.fetch).toHaveBeenCalledTimes(2); // Listing and image only.
    });

    it.each(['moved', 'trashed'] as const)('recovers a cached JSON ID that was %s while the photo was uploading', async state => {
        const oldJson = drive.put('json', 'data.json', 'application/json', 'folder', { ...template, updatedAt: 2 });
        pauseFirstImage();
        const task = backup();
        await waitForImage();
        if (state === 'moved') oldJson.parents = ['outside'];
        else oldJson.trashed = true;
        releaseImage!();
        await task;
        expect(drive.visibleJson()).toMatchObject([{ content: { updatedAt: 3 } }]);
        expect((await googleDriveService.getFileContent('folder')).updatedAt).toBe(3);
        expect(drive.files.get('folder')!.appProperties?.originalUpdatedAt).toBe('3');
        expect(drive.files.get('old-image')!.trashed).toBe(true);
        expect(state === 'moved' ? oldJson.parents : oldJson.trashed).toEqual(state === 'moved' ? ['outside'] : true);
    });

    it('stops after one recovery attempt and keeps old images and success metadata unchanged if the replacement is also invalid', async () => {
        drive.put('json', 'data.json', 'application/json');
        const transport = drive.fetch.getMockImplementation()!;
        drive.fetch.mockImplementation(async (input, init) => {
            const response = await transport(input, init);
            if (!String(input).includes('/upload/')) return response;
            const file = await response.json();
            if (file.mimeType === 'application/json') drive.files.get(file.id)!.parents = ['outside'];
            return json(drive.files.get(file.id));
        });
        await expect(backup()).rejects.toThrow('not available in the backup folder');
        expect(drive.visibleJson()).toHaveLength(0);
        expect(drive.files.get('folder')!.appProperties).toBeUndefined();
        expect(drive.files.get('old-image')!.trashed).toBe(false);
        const uploadAttempts = drive.fetch.mock.calls.filter(([input]) => String(input).includes('/upload/'));
        expect(uploadAttempts).toHaveLength(3); // One image and exactly two JSON attempts.
    });

    it('refuses to overwrite settings created after the initial read; a fresh retry merges their cloud-only players', async () => {
        const local = { preferences: {}, library: { players: [{ name: 'Local' }], locations: [] }, system: {} };
        const remote = { ...local, library: { players: [{ name: 'Cloud only' }], locations: [] } };
        const transport = drive.fetch.getMockImplementation()!;
        let searches = 0;
        drive.fetch.mockImplementation(async (input, init) => {
            const query = new URL(String(input)).searchParams.get('q');
            if (query?.includes("name = 'settings_backup.json'") && ++searches === 2) {
                drive.put('settings', 'settings_backup.json', 'application/json', 'system', remote);
            }
            return transport(input, init);
        });
        await expect(systemSyncService.mergeAndBackupSystemSettings(local)).rejects.toThrow('appeared after it was read');
        expect(drive.files.get('settings')!.content).toEqual(remote);
        expect(drive.fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true);
        expect(await systemSyncService.mergeAndBackupSystemSettings(local)).toBe(true);
        expect(drive.files.get('settings')!.content.library.players).toEqual([{ name: 'Cloud only' }, { name: 'Local' }]);
    });
});

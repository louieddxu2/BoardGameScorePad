import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { exportOfflineBackup } from './export';
import { importOfflineBackup } from './import';
import { validateOfflineBackup } from './validate';
import { DATA_TABLES, ROOT, MANIFEST, jsonBytes, parseJson, readBlob, pack, unpack, digest, type Manifest } from './format';
import type { GameTemplate, HistoryRecord } from '../../types';

vi.mock('../../db', async () => {
  const { default: Dexie } = await import('dexie');
  const { indexedDB, IDBKeyRange } = await import('fake-indexeddb');
  const database = new Dexie('offline-backup-test', { indexedDB, IDBKeyRange });
  const { DATA_TABLES: names } = await import('./format');
  const stores: Record<string, string> = Object.fromEntries(names.map(name => [name,
    name === 'templatePrefs' ? 'templateId' : name === 'analyticsLogs' ? 'historyId' : name === 'savedPlayers' ? 'id,&name' : 'id']));
  Object.assign(stores, { images: 'id', builtins: 'id', systemOverrides: 'id', savedCurrentSession: 'id',
    templateShareCache: 'templateId', multiplayerRooms: 'roomId', multiplayerDevices: 'id', multiplayerSequences: 'id',
    multiplayerOutbox: 'id', multiplayerPatchReceipts: 'id', multiplayerParticipantBindings: 'id' });
  database.version(1).stores(stores);
  return { db: database };
});

const template: GameTemplate = { id: 'ab12cd34', name: '測試/遊戲', columns: [{ id: 'score', name: '分數', formula: 'a1', inputType: 'keypad', isScoring: true }],
  createdAt: 1, imageId: 'background', hasImage: true, cloudImageId: 'old-cloud-image' };
const player = { id: 'p1', name: '玩家', color: '#ffffff', scores: { score: { parts: [12] } }, totalScore: 12 };
const record: HistoryRecord = { id: 'h1', templateId: template.id, gameName: template.name, startTime: 1, endTime: 2,
  players: [player], winnerIds: ['p1'], snapshotTemplate: template, photos: ['photo'], photoContentIds: { photo: 'r2' },
  cloudFolderId: 'old-folder', photoCloudIds: { 'photo@r2': 'old-cloud-photo' } };

async function seed() {
  await db.templates.put(template);
  await db.builtins.put({ ...template, id: 'builtin' });
  await db.table('systemOverrides').put({ ...template, id: 'builtin' });
  await db.history.put(record);
  await db.sessions.put({ id: 'active', templateId: template.id, name: template.name, startTime: 3, players: [player], status: 'active' });
  await db.images.bulkPut([
    { id: 'background', relatedId: template.id, relatedType: 'template', createdAt: 1, mimeType: 'image/jpeg', blob: new Blob(['background'], { type: 'image/jpeg' }) },
    { id: 'photo', relatedId: record.id, relatedType: 'session', createdAt: 2, mimeType: 'image/jpeg', contentId: 'r2',
      blob: new Blob(['rotated-photo'], { type: 'image/jpeg' }), rotationSource: { blob: new Blob(['original']), quarterTurns: 1 } },
    { id: 'builtin-bg', relatedId: 'builtin', relatedType: 'template', createdAt: 0, mimeType: 'image/jpeg', blob: new Blob(['builtin']) },
  ]);
  await db.savedPlayers.put({ id: 'p1', name: '玩家', lastUsed: 2, usageCount: 1 });
  await db.weights.put({ id: 'weight', weights: { player: 2 }, updatedAt: 1 });
  await db.savedGames.put({ id: 'game-id', name: template.name, lastUsed: 1, usageCount: 1 });
  await db.analyticsLogs.put({ historyId: 'h1', status: 'processed', lastProcessedAt: 2 });
  localStorage.setItem('sm_pinned_ids', JSON.stringify([template.id]));
  localStorage.setItem('app_theme_mode', 'sage');
  localStorage.setItem('google_user_email', 'private@example.test');
}

async function rewrite(blob: Blob, edit: (files: Record<string, Uint8Array>, manifest: Manifest) => Promise<void> | void) {
  const files = await unpack(await readBlob(blob));
  const manifest = parseJson(files[MANIFEST]) as Manifest;
  await edit(files, manifest);
  files[MANIFEST] = jsonBytes(manifest);
  return new Blob([new Uint8Array(await pack(files)).buffer], { type: 'application/zip' });
}

beforeEach(async () => {
  const cryptoModule = 'node:crypto';
  const bufferModule = 'node:buffer';
  const { webcrypto } = await import(/* @vite-ignore */ cryptoModule);
  const { Blob } = await import(/* @vite-ignore */ bufferModule);
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('Blob', Blob);
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); }, removeItem: (key: string) => { values.delete(key); } });
  for (const table of db.tables) await table.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('offline full-data backup', () => {
  it('round-trips readable cloud folders, original photo bytes, IDs and local learning data while preserving built-ins', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    const files = await unpack(await readBlob(archive));
    expect(Object.keys(files)).toContain(`${ROOT}_Templates/測試_遊戲_ab12cd34/data.json`);
    const historyFolder = `${ROOT}_History/測試_遊戲_h1`;
    expect(parseJson(files[`${historyFolder}/session.json`])).toEqual(record);
    expect(new TextDecoder().decode(files[`${historyFolder}/photo_r2.jpg`])).toBe('rotated-photo');
    expect(Object.keys(files).some(path => path.includes('builtin'))).toBe(false);
    const settings = parseJson(files[`${ROOT}_System/settings_backup.json`]) as Record<string, unknown>;
    expect(settings.library).toMatchObject({ players: [{ id: 'p1', name: '玩家' }] });
    expect(new TextDecoder().decode(files[MANIFEST])).not.toContain('private@example.test');
    await db.templates.put({ ...template, id: 'old' });
    await db.history.clear();
    await db.savedPlayers.put({ id: 'old-player', name: 'old', lastUsed: 0, usageCount: 0 });
    await db.table('multiplayerOutbox').put({ id: 'outdated-delivery' });
    localStorage.setItem('app_theme_mode', 'light');
    await importOfflineBackup(archive);
    expect(await db.templates.toArray()).toEqual([expect.objectContaining({ id: template.id, imageId: 'background' })]);
    expect(await db.templates.get(template.id)).not.toHaveProperty('cloudImageId');
    expect(await db.history.get('h1')).toMatchObject({ id: 'h1', winnerIds: ['p1'], players: [player], photoContentIds: { photo: 'r2' } });
    expect(await db.history.get('h1')).not.toHaveProperty('cloudFolderId');
    expect(await db.savedPlayers.count()).toBe(1);
    expect(await db.savedGames.get('game-id')).toBeDefined();
    expect(await db.weights.get('weight')).toBeDefined();
    expect(await db.analyticsLogs.get('h1')).toBeDefined();
    const photo = (await db.images.get('photo'))!;
    expect(await photo.blob.text()).toBe('rotated-photo');
    expect(await photo.rotationSource!.blob.text()).toBe('original');
    expect(photo.contentId).toBe('r2');
    expect(photo.rotationSource!.quarterTurns).toBe(1);
    expect(await db.multiplayerOutbox.count()).toBe(0);
    expect(await db.builtins.get('builtin')).toEqual({ ...template, id: 'builtin' });
    expect(await (await db.images.get('builtin-bg'))!.blob.text()).toBe('builtin');
    expect(await db.table('systemOverrides').get('builtin')).toEqual({ ...template, id: 'builtin' });
    expect(localStorage.getItem('sm_pinned_ids')).toBe(JSON.stringify([template.id]));
    expect(localStorage.getItem('app_theme_mode')).toBe('sage');
    expect(localStorage.getItem('google_user_email')).toBe('private@example.test');
  });

  it('rejects incomplete or corrupted photos before replacing any existing data', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    for (const missing of [true, false]) {
      const damaged = await rewrite(archive, (files, manifest) => {
        const path = manifest.images.find(image => image.id === 'photo')!.path;
        if (missing) delete files[path];
        else files[path][0] ^= 1;
      });
      await expect(importOfflineBackup(damaged)).rejects.toMatchObject({ code: 'invalid' });
      expect(await db.history.get('h1')).toEqual(record);
      expect(await db.images.count()).toBe(3);
    }
  });

  it('rolls back every table if a unique-index write fails after earlier clears', async () => {
    await seed();
    const damaged = await rewrite(await exportOfflineBackup(), async (files, manifest) => {
      const path = manifest.tables.savedPlayers[0];
      files[path] = jsonBytes([{ id: 'a', name: 'duplicate' }, { id: 'b', name: 'duplicate' }]);
      manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
    });
    await expect(importOfflineBackup(damaged)).rejects.toThrow();
    expect(await db.history.get('h1')).toEqual(record);
    expect(await db.templates.get(template.id)).toEqual(template);
    expect(await db.savedPlayers.toArray()).toMatchObject([{ id: 'p1' }]);
    expect(localStorage.getItem('app_theme_mode')).toBe('sage');
  });

  it('rolls back tables and preferences when localStorage fails during replacement', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    localStorage.setItem('app_theme_mode', 'light');
    await db.history.update('h1', { note: 'keep this' });
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(setItem)
      .mockImplementationOnce(() => { throw new Error('storage failed'); }).mockImplementation(setItem);
    await expect(importOfflineBackup(archive)).rejects.toThrow('storage failed');
    expect(await db.history.get('h1')).toHaveProperty('note', 'keep this');
    expect(localStorage.getItem('app_theme_mode')).toBe('light');
  });

  it('rejects missing source photos, invalid preferences and built-in template injection', async () => {
    await seed();
    await db.images.delete('photo');
    await expect(exportOfflineBackup()).rejects.toMatchObject({ code: 'missing_image' });
    await db.history.clear();
    const archive = await exportOfflineBackup();
    const badPreferences = await rewrite(archive, (_files, manifest) => { manifest.preferences.sm_pinned_ids = '{broken'; });
    await expect(validateOfflineBackup(badPreferences)).rejects.toMatchObject({ code: 'invalid' });
    const builtin = await rewrite(archive, async (files, manifest) => {
      const path = manifest.tables.templates[0];
      files[path] = jsonBytes({ ...template, id: 'builtin' });
      manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
    });
    await expect(importOfflineBackup(builtin)).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.templates.get(template.id)).toBeDefined();
  });

  it('does not restore room or device state and rejects replacement while a room is active', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    await db.table('multiplayerRooms').put({ roomId: 'live-room', status: 'active' });
    await expect(importOfflineBackup(archive)).rejects.toMatchObject({ code: 'busy' });
    expect(await db.history.get('h1')).toEqual(record);
  });

  it('can replace a populated installation with a valid empty backup', async () => {
    const empty = await exportOfflineBackup();
    await seed();
    await importOfflineBackup(empty);
    for (const table of DATA_TABLES) expect(await db.table(table).count(), table).toBe(0);
    expect(await db.builtins.count()).toBe(1);
    expect(localStorage.getItem('sm_pinned_ids')).toBeNull();
  });
});

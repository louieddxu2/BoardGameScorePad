import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { exportOfflineBackup } from './export';
import { importOfflineBackup } from './import';
import { validateOfflineBackup } from './validate';
import { DATA_TABLES, PREFERENCE_KEYS, ROOT, MANIFEST, jsonBytes, parseJson, readBlob, pack, unpack, digest, type Manifest } from './format';
import type { GameTemplate, HistoryRecord } from '../../types';
import { migrateTemplate } from '../../utils/dataMigration';
import { getRecordTemplate } from '../../utils/historyUtils';
import { loadSessionActivation } from '../../hooks/sessionActivation';
import { imageService } from '../imageService';

vi.mock('../../db', async () => {
  const { default: Dexie } = await import('dexie');
  const { indexedDB, IDBKeyRange } = await import('fake-indexeddb');
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  // Use the production schema against in-memory IndexedDB, never the user's DB.
  const { ScorePadDatabase } = await vi.importActual<typeof import('../../db')>('../../db');
  return { db: new ScorePadDatabase() };
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
  it('preserves legacy simple-history snapshot markers supported by the history viewer', async () => {
    await seed();
    await db.history.clear();
    const markers = [[], {}, { bggId: '123', defaultScoringRule: 'COOP' }];
    for (const [index, snapshotTemplate] of markers.entries()) {
      await db.table('history').put({ ...record, id: `legacy-${index}`, snapshotTemplate });
    }
    const archive = await exportOfflineBackup();
    await db.history.clear();
    await importOfflineBackup(archive);
    for (const [index, snapshot] of markers.entries()) {
      const restored = (await db.history.get(`legacy-${index}`))!;
      expect(restored.snapshotTemplate).toEqual(snapshot);
      expect(restored.players).toEqual(record.players);
      expect(restored.winnerIds).toEqual(record.winnerIds);
      expect(getRecordTemplate(restored)).toMatchObject({ id: record.templateId, name: record.gameName });
    }
    for (const [patch, field] of [
      [{ snapshotTemplate: { ...template, columns: 'broken' } }, 'snapshotTemplate.columns'],
      [{ players: [{ ...player, totalScore: 'broken' }] }, 'players[0].totalScore'],
    ] as const) {
      const damaged = await rewrite(archive, async (files, manifest) => {
        const path = manifest.tables.history[0];
        files[path] = jsonBytes({ ...(parseJson(files[path]) as object), ...patch });
        manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
      });
      await expect(importOfflineBackup(damaged)).rejects.toMatchObject({
        code: 'invalid', message: `table: history / row: 1 / ${field}`,
      });
      expect(await db.history.count()).toBe(markers.length);
    }
  });

  it('round-trips legacy columns without rewriting snapshots and still rejects malformed formulas before replacement', async () => {
    await seed();
    const legacy = { ...template, columns: [
      { id: 'score', name: '分數', type: 'number', weight: 2 },
      { id: 'choice', name: '選項', type: 'select', options: [{ label: '完成', value: 5 }] },
    ] };
    await db.table('templates').put(legacy);
    await db.table('history').put({ ...record, snapshotTemplate: legacy });
    const archive = await exportOfflineBackup();
    await db.templates.clear();
    await db.history.clear();
    await importOfflineBackup(archive);
    expect(await db.templates.get(template.id)).toEqual(expect.objectContaining({ columns: legacy.columns }));
    const restored = (await db.history.get(record.id))!;
    expect(restored.snapshotTemplate.columns).toEqual(legacy.columns);
    expect(restored.players).toEqual(record.players);
    expect(migrateTemplate(restored.snapshotTemplate).columns).toMatchObject([
      { id: 'score', formula: 'a1×c1', constants: { c1: 2 } },
      { id: 'choice', formula: 'a1', inputType: 'clicker', quickActions: [{ label: '完成', value: 5 }] },
    ]);
    const malformed = await rewrite(archive, async (files, manifest) => {
      const path = manifest.tables.templates[0];
      files[path] = jsonBytes({ ...legacy, columns: [{ ...legacy.columns[0], formula: false }] });
      manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
    });
    await expect(importOfflineBackup(malformed)).rejects.toMatchObject({
      code: 'invalid', message: 'table: templates / row: 1 / columns[0].formula',
    });
    expect((await db.history.get(record.id))!.snapshotTemplate.columns).toEqual(legacy.columns);
  });

  it('copies the complete local snapshot even when history retains a deleted background or an older photo revision marker', async () => {
    await seed();
    // Replacing a template background deletes the old image, but history keeps its snapshot ID.
    await db.images.delete('background');
    await db.templates.update(template.id, { imageId: 'new-background' });
    await db.images.put({ id: 'new-background', relatedId: template.id, relatedType: 'template',
      createdAt: 3, mimeType: 'image/jpeg', blob: new Blob(['new background'], { type: 'image/jpeg' }) });
    await db.images.put({ ...(await db.images.get('photo'))!, contentId: 'r3' });
    const onMissing = vi.fn();
    const archive = await exportOfflineBackup(undefined, onMissing);
    const files = await unpack(await readBlob(archive));
    expect(onMissing).toHaveBeenCalledWith(['background']);
    expect(parseJson(files[MANIFEST])).toHaveProperty('missingImageIds', ['background']);
    expect(Object.keys(files)).toContain(`${ROOT}_System/missing_image_references.json`);
    expect(Object.keys(files)).toContain(`${ROOT}_History/測試_遊戲_h1/photo_r3.jpg`);
    await importOfflineBackup(archive);
    expect((await db.history.get('h1'))!.snapshotTemplate.imageId).toBe('background');
    expect((await db.history.get('h1'))!.photoContentIds).toEqual({ photo: 'r2' });
    expect((await db.images.get('photo'))!.contentId).toBe('r3');
    expect(await (await db.images.get('new-background'))!.blob.text()).toBe('new background');
  });

  it('round-trips readable cloud folders, original photo bytes, IDs and local learning data while preserving built-ins', async () => {
    await seed();
    await db.templatePrefs.put({ templateId: template.id, lastPlayerCount: 4, defaultScoringRule: 'COOP_NO_SCORE' });
    await db.savedLocations.put({ id: 'loc1', name: '家裡', lastUsed: 2, usageCount: 3 });
    await db.bggGames.put({ id: '123', name: 'Game', altNames: ['遊戲'], updatedAt: 4 });
    for (const table of ['savedWeekdays', 'savedTimeSlots', 'savedPlayerCounts', 'savedGameModes', 'savedGameLifecycleContexts'] as const) {
      await db.table(table).put({ id: `${table}-entry`, name: table, lastUsed: 5, usageCount: 8,
        meta: { relations: { players: [{ id: 'p1', weight: 0.5 }] } } });
    }
    const preferences = {
      app_theme_mode: 'sage', app_language: 'en', app_zoom_level: '1.3', app_edit_mode: 'false', app_voice_enabled: 'true',
      sm_pinned_ids: JSON.stringify([template.id, 'builtin']), sm_new_badge_ids: '["builtin"]',
      sm_pref_advance_direction: 'horizontal', sm_pref_standard_unit: '分', sm_pref_product_unit_a: '',
      sm_pref_product_unit_b: '棟', sm_pref_editor_adv: 'true',
    };
    for (const key of PREFERENCE_KEYS) localStorage.setItem(key, preferences[key]);
    const expectedTables = new Map(await Promise.all(DATA_TABLES.filter(name => !['templates', 'history', 'sessions'].includes(name))
      .map(async name => [name, await db.table(name).toArray()] as const)));
    await db.table('history').put({ ...record, id: 'simple-history', snapshotTemplate: undefined, photos: [] });
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
    // Fresh user stores, as in a private window; retain only this installation's built-ins.
    for (const table of DATA_TABLES) await db.table(table).clear();
    await db.images.filter(image => image.relatedId !== 'builtin').delete();
    await db.templates.put({ ...template, id: 'old' });
    await db.savedPlayers.put({ id: 'old-player', name: 'old', lastUsed: 0, usageCount: 0 });
    await db.table('multiplayerOutbox').put({ id: 'outdated-delivery' });
    localStorage.setItem('app_theme_mode', 'light');
    await importOfflineBackup(archive);
    expect(await db.templates.toArray()).toEqual([expect.objectContaining({ id: template.id, imageId: 'background' })]);
    expect(await db.templates.get(template.id)).not.toHaveProperty('cloudImageId');
    expect(await db.history.get('h1')).toMatchObject({ id: 'h1', winnerIds: ['p1'], players: [player], photoContentIds: { photo: 'r2' } });
    expect(await db.history.get('h1')).not.toHaveProperty('cloudFolderId');
    expect(await db.history.get('simple-history')).not.toHaveProperty('snapshotTemplate');
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
    for (const [name, rows] of expectedTables) expect(await db.table(name).toArray(), name).toEqual(rows);
    for (const key of PREFERENCE_KEYS) expect(localStorage.getItem(key), key).toBe(preferences[key]);
    expect(localStorage.getItem('google_user_email')).toBe('private@example.test');
    const legacy = await rewrite(archive, (_files, manifest) => { manifest.version = 1; });
    await expect(importOfflineBackup(legacy)).resolves.toBeUndefined();
  });

  it('restores mixed legacy records, unnamed/orphaned sessions and image Blobs without MIME metadata from an existing ZIP', async () => {
    await seed();
    const legacyTemplate = { ...template, imageId: undefined, hasImage: false,
      columns: [{ id: 'score', name: '分數', formula: null, weight: 2 }] };
    await db.table('templates').put(legacyTemplate);
    const legacyRecord = { ...record, id: 'legacy-null', photos: null, photoContentIds: null,
      snapshotTemplate: { columns: null, bggId: '123' },
      players: [{ ...player, color: 'transparent', totalScore: -12.5, scores: { score: -12.5 } }], winnerIds: [] };
    await db.table('history').put(legacyRecord);
    await db.table('sessions').put({ id: 'unnamed', templateId: template.id, players: [player], startTime: 1, status: 'active' });
    await db.sessions.put({ id: 'orphan', templateId: 'deleted-template', name: '原有遊戲', players: [player], startTime: 1, status: 'active' });
    const image = await imageService.saveImage(new Blob(['raw-image']), record.id, 'session', 'untyped-image');
    await db.images.put({ ...image, rotationSource: { blob: new Blob(['original-image'], { type: 'application/octet-stream' }), quarterTurns: 2 } });
    // Version 1 also stored JSON rows verbatim; consume the existing bytes, not a re-export after clearing data.
    const archive = await rewrite(await exportOfflineBackup(), (_files, manifest) => { manifest.version = 1; });
    for (const table of DATA_TABLES) await db.table(table).clear();
    await db.images.filter(row => row.relatedId !== 'builtin').delete();
    await importOfflineBackup(archive);
    const restored = (await db.history.get(legacyRecord.id))!;
    const { cloudFolderId: _folder, photoCloudIds: _photos, ...expectedRecord } = legacyRecord;
    expect(restored).toEqual(expectedRecord);
    expect(getRecordTemplate(restored)).toMatchObject({ id: template.id, name: record.gameName, columns: [] });
    const unnamed = (await db.sessions.get('unnamed'))!;
    expect(unnamed).not.toHaveProperty('name');
    const activated = await loadSessionActivation(unnamed, async id => await db.templates.get(id) ?? null, () => true);
    expect(activated?.session.name).toBe(template.name);
    expect(activated?.template.columns[0].formula).toBe('a1×c1');
    expect(await db.sessions.get('orphan')).toMatchObject({ templateId: 'deleted-template', name: '原有遊戲' });
    const restoredImage = (await db.images.get(image.id))!;
    expect(restoredImage.mimeType).toBe('');
    expect(await restoredImage.blob.text()).toBe('raw-image');
    expect(await restoredImage.rotationSource!.blob.text()).toBe('original-image');
  });

  it('keeps distinct records and photo revisions whose names previously produced the same ZIP path', async () => {
    await seed();
    const photoImages = [
      { id: 'photo', contentId: 'a_b', body: 'first-photo' },
      { id: 'photo_a', contentId: 'b', body: 'second-photo' },
    ];
    for (const image of photoImages) await imageService.saveImage(new Blob([image.body], { type: 'image/jpeg' }), 'h1', 'session', image.id, image.contentId);
    await db.history.update('h1', { photos: photoImages.map(image => image.id) });
    await db.history.put({ ...record, id: 'b_c', gameName: 'Game', photos: [] });
    await db.history.put({ ...record, id: 'c', gameName: 'Game_b', photos: [] });
    const archive = await exportOfflineBackup();
    await db.history.clear();
    await importOfflineBackup(archive);
    expect(await db.history.count()).toBe(3);
    expect(await db.history.get('b_c')).toMatchObject({ gameName: 'Game' });
    expect(await db.history.get('c')).toMatchObject({ gameName: 'Game_b' });
    for (const image of photoImages) expect(await (await db.images.get(image.id))!.blob.text()).toBe(image.body);
  });

  it('refuses to export data the shared importer would reject before producing a ZIP', async () => {
    await seed();
    const progress = vi.fn();
    await db.table('templates').update(template.id, { imageId: 42 });
    await expect(exportOfflineBackup(progress)).rejects.toMatchObject({
      code: 'invalid', message: 'table: templates / row: 1 / imageId',
    });
    await db.templates.put(template);
    await db.table('history').update(record.id, { players: [{ ...player, totalScore: 'broken' }] });
    await expect(exportOfflineBackup(progress)).rejects.toMatchObject({
      code: 'invalid', message: 'table: history / row: 1 / players[0].totalScore',
    });
    expect(progress).not.toHaveBeenCalledWith('ZIP');
  });

  it('rejects incomplete or corrupted photos before replacing any existing data', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    for (const missing of [true, false]) {
      const damaged = await rewrite(archive, (files, manifest) => {
        const path = manifest.images.find(image => image.id === 'photo')!.path;
        if (missing) {
          delete files[path];
          manifest.missingImageIds = ['photo'];
        }
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

  it('preserves missing local photo references while still rejecting invalid preferences and built-in template injection', async () => {
    await seed();
    await db.images.delete('photo');
    const localCopy = await exportOfflineBackup();
    const restored = await validateOfflineBackup(localCopy);
    expect(restored.tables.history[0].photos).toEqual(['photo']);
    expect(restored.images.some(image => image.id === 'photo')).toBe(false);
    await importOfflineBackup(localCopy);
    expect((await db.history.get('h1'))!.photos).toEqual(['photo']);
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

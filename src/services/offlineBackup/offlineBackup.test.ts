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
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotoImages } from '../../hooks/usePhotoImages';

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
  it('restores eight albums through ZIP, database and album URLs even when a middle photo fails', async () => {
    const expected = new Map<string, string>();
    const games: HistoryRecord[] = [];
    const blobs = new Map<string, Blob>();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL(blob: Blob) {
        const url = `blob:restored-${blobs.size}`;
        blobs.set(url, blob);
        return url;
      }
      static revokeObjectURL() {}
    });
    for (let game = 0; game < 8; game++) {
      const board = { ...template, id: `game-${game}`, name: `遊戲 ${game}`, imageId: undefined, cloudImageId: undefined };
      if (game % 2 === 0) await db.builtins.put(board);
      else await db.templates.put(board);
      const entry: HistoryRecord = { ...record, id: `history-${game}`, gameName: board.name, templateId: board.id,
        snapshotTemplate: board, photos: [], photoContentIds: {} };
      for (let photo = 0; photo < 3; photo++) {
        const id = crypto.randomUUID();
        const bytes = new Uint8Array([512, 327681, 524288][photo]);
        for (let offset = 0; offset < bytes.length; offset++) bytes[offset] = (offset + game * 3 + photo) % 256;
        const contentId = photo === 1 ? crypto.randomUUID() : undefined;
        const mimeType = ['image/jpeg', '', 'application/octet-stream'][photo];
        await imageService.saveImage(new Blob([bytes.buffer], { type: mimeType }), entry.id, 'session', id, contentId);
        entry.photos!.push(id);
        if (contentId) entry.photoContentIds![id] = contentId;
        expected.set(id, await digest(bytes));
      }
      games.push(entry);
      await db.history.put(entry);
    }
    const archive = await exportOfflineBackup();
    const files = await unpack(await readBlob(archive));
    const manifest = parseJson(files[MANIFEST]) as Manifest;
    expect(manifest.images).toHaveLength(expected.size);
    for (const image of manifest.images) expect(await digest(files[image.path]), image.id).toBe(expected.get(image.id));
    const middle = manifest.images[12];
    for (const failure of ['none', 'missing', 'checksum', 'metadata']) {
      const input = failure === 'none' ? archive : await rewrite(archive, (contents, index) => {
        if (failure === 'missing') delete contents[middle.path];
        else if (failure === 'checksum') contents[middle.path][0] ^= 1;
        else Object.assign(index.images.find(image => image.id === middle.id)!, { relatedType: 'invalid' });
      });
      for (const table of DATA_TABLES) await db.table(table).clear();
      await db.images.clear();
      const report = await importOfflineBackup(input);
      if (failure === 'none') expect(report.issues).toEqual([]);
      else expect(report.issues).toEqual([expect.objectContaining({ path: middle.path.slice(ROOT.length),
        reason: failure === 'metadata' ? 'invalid' : failure })]);
      expect(await db.history.count(), failure).toBe(8);
      expect(await db.images.count(), failure).toBe(expected.size - (failure === 'none' ? 0 : 1));
      for (const entry of games) {
        const restored = (await db.history.get(entry.id))!;
        expect(restored.photos).toEqual(entry.photos);
        const wanted = [...entry.photos!].reverse().filter(id => failure === 'none' || id !== middle.id);
        const { result, unmount } = renderHook(() => usePhotoImages(restored.photos!, restored.photoContentIds));
        try {
          await waitFor(() => expect(result.current.images.map(image => image.id), failure).toEqual(wanted));
          expect(result.current.loading).toBe(false);
          for (const image of result.current.images) {
            expect(await digest(await readBlob(blobs.get(image.url)!)), `${failure}: ${image.id}`).toBe(expected.get(image.id));
          }
        } finally { unmount(); }
      }
    }
  });

  it('recovers usable records when any declared file is missing, truncated, changed or invalid JSON', async () => {
    await seed();
    await db.history.put({ ...record, id: 'healthy-history', photos: [] });
    const archive = await exportOfflineBackup();
    const manifest = parseJson((await unpack(await readBlob(archive)))[MANIFEST]) as Manifest;
    let checked = 0;
    for (const path of Object.keys(manifest.files)) {
      for (const mode of ['missing', 'truncated', 'changed', ...(path.endsWith('.json') ? ['json'] : [])]) {
        const damaged = await rewrite(archive, async (files, index) => {
          if (mode === 'missing') delete files[path];
          else if (mode === 'truncated') files[path] = files[path].subarray(0, Math.max(0, files[path].length - 1));
          else if (mode === 'changed') files[path][0] ^= 1;
          else {
            files[path] = new TextEncoder().encode('{broken');
            index.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
          }
        });
        const report = await importOfflineBackup(damaged);
        expect(report.issues, `${mode}: ${path}`).toContainEqual(expect.objectContaining({ path: path.slice(ROOT.length),
          reason: mode === 'missing' ? 'missing' : mode === 'json' ? 'invalid' : 'checksum' }));
        if (path !== manifest.tables.history[1]) {
          expect(await db.history.get('healthy-history'), path).toMatchObject({ players: record.players, winnerIds: record.winnerIds });
        } else expect(await db.history.get('h1')).toMatchObject({ players: record.players });
        if (path === manifest.images.find(image => image.id === 'photo')!.rotationSource!.path) {
          expect(await (await db.images.get('photo'))!.blob.text()).toBe('rotated-photo');
          expect((await db.images.get('photo'))!.rotationSource).toBeUndefined();
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(60);
    const reExported = await unpack(await readBlob(await exportOfflineBackup()));
    expect(reExported[`${ROOT}_System/restore_report.json`]).toBeUndefined();
  }, 15000);

  it.each([32, 800000])('isolates a broken DEFLATE stream with %i bytes of input, including worker decoding', async sizeOfNote => {
    await seed();
    let state = 123456;
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const note = Array.from({ length: sizeOfNote }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return alphabet[(state >>> 16) % alphabet.length];
    }).join('');
    await db.history.update('h1', { note });
    await db.history.put({ ...record, id: 'healthy-history', photos: [] });
    const archive = await exportOfflineBackup();
    const target = `${ROOT}_History/測試_遊戲_h1/session.json`;
    const targets = new Set([target, `${ROOT}_Templates/測試_遊戲_ab12cd34/data.json`]);
    const bytes = await readBlob(archive);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let damaged = 0;
    for (let offset = 0; offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50;) {
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const size = view.getUint32(offset + 18, true);
      const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
      const payload = offset + 30 + nameLength + extraLength;
      if (targets.has(name)) {
        expect(view.getUint16(offset + 8, true)).toBe(8);
        if (name === target && sizeOfNote > 320000) expect(size).toBeGreaterThan(320000);
        bytes[payload] = 7; // Reserved DEFLATE block type: decompression must fail.
        damaged++;
      }
      offset = payload + size;
    }
    expect(damaged).toBe(2);
    const report = await importOfflineBackup(new Blob([new Uint8Array(bytes).buffer]));
    for (const path of targets) expect(report.issues).toContainEqual({ path: path.slice(ROOT.length), reason: 'checksum' });
    expect(await db.history.get('h1')).toBeUndefined();
    expect(await db.history.get('healthy-history')).toMatchObject({ players: record.players });
    expect(await db.templates.get(template.id)).toBeUndefined();
    expect(await db.savedPlayers.get('p1')).toBeDefined();
    // This photo follows the broken JSON entries in ZIP order.
    expect(await (await db.images.get('photo'))!.blob.text()).toBe('rotated-photo');
  }, 10000);

  it('isolates simultaneous missing files and malformed or duplicate list rows while keeping healthy rows', async () => {
    await seed();
    await db.history.put({ ...record, id: 'healthy-history', photos: [] });
    const damaged = await rewrite(await exportOfflineBackup(), async (files, manifest) => {
      delete files[manifest.images.find(image => image.id === 'photo')!.path];
      delete files[manifest.tables.history[0]];
      const path = manifest.tables.savedPlayers[0];
      files[path] = jsonBytes([
        { id: 'first', name: 'duplicate' }, { id: 'second', name: 'duplicate' },
        { id: 'invalid' }, { id: 'healthy', name: 'healthy' },
      ]);
      manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
    });
    const report = await importOfflineBackup(damaged);
    expect(await db.history.get('healthy-history')).toMatchObject({ players: record.players });
    expect((await db.savedPlayers.toArray()).map(row => row.id)).toEqual(['first', 'healthy']);
    expect(report.issues).toContainEqual(expect.objectContaining({ reason: 'missing' }));
    expect(report.issues).toContainEqual(expect.objectContaining({ detail: 'duplicate key' }));
    expect(report.issues.filter(issue => issue.reason === 'invalid')).toHaveLength(2);
  });

  it('stops before replacement when the backup index itself cannot be read', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    for (const mode of ['missing index', 'invalid index', 'no payload']) {
      const files = await unpack(await readBlob(archive));
      if (mode === 'missing index') delete files[MANIFEST];
      else if (mode === 'invalid index') files[MANIFEST] = new TextEncoder().encode('{broken');
      else for (const path of Object.keys(files)) if (path !== MANIFEST) delete files[path];
      await expect(importOfflineBackup(new Blob([new Uint8Array(await pack(files)).buffer]))).rejects.toMatchObject({ code: 'invalid' });
      expect(await db.history.get(record.id)).toEqual(record);
    }
  });

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
      const report = await importOfflineBackup(damaged);
      expect(report.issues).toContainEqual(expect.objectContaining({ reason: 'invalid', detail: field }));
      expect(await db.history.count()).toBe(markers.length - 1);
      expect(await db.history.get('legacy-1')).toBeDefined();
    }
  });

  it('round-trips legacy columns without rewriting snapshots and isolates malformed formulas', async () => {
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
    expect((await importOfflineBackup(malformed)).issues).toContainEqual(expect.objectContaining({ reason: 'invalid', detail: 'columns[0].formula' }));
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
    const report = await importOfflineBackup(archive);
    expect(report.issues).toEqual([]);
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
      sm_pref_standard_unit: '分', sm_pref_product_unit_a: '',
      sm_pref_product_unit_b: '棟', sm_pref_editor_adv: 'true',
    };
    for (const key of PREFERENCE_KEYS) localStorage.setItem(key, preferences[key]);
    localStorage.setItem('sm_pref_advance_direction', 'horizontal');
    const expectedTables = new Map(await Promise.all(DATA_TABLES.filter(name => !['templates', 'history', 'sessions'].includes(name))
      .map(async name => [name, await db.table(name).toArray()] as const)));
    await db.table('history').put({ ...record, id: 'simple-history', snapshotTemplate: undefined, photos: [] });
    const archive = await exportOfflineBackup();
    const files = await unpack(await readBlob(archive));
    expect(parseJson(files[MANIFEST])).toHaveProperty('preferences', expect.not.objectContaining({ sm_pref_advance_direction: expect.anything() }));
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
    const legacy = await rewrite(archive, (_files, manifest) => {
      manifest.version = 1;
      manifest.databaseVersion = 33;
      Object.assign(manifest.preferences, { sm_pref_advance_direction: 'horizontal' });
    });
    await expect(importOfflineBackup(legacy)).resolves.toMatchObject({ issues: [] });
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

  it('exports readable raw data and records damaged local items without blocking healthy records', async () => {
    await seed();
    await db.table('templates').update(template.id, { imageId: 42 });
    await db.table('history').update(record.id, { players: [{ ...player, totalScore: 'broken' }] });
    await db.history.put({ ...record, id: 'healthy', photos: ['missing-blob', 'unreadable-source'] });
    await db.table('images').put({ id: 'missing-blob', relatedId: 'healthy', relatedType: 'session', createdAt: 1, mimeType: '' });
    await db.table('images').put({ id: 'unreadable-source', relatedId: 'healthy', relatedType: 'session',
      createdAt: 1, mimeType: 'image/jpeg', blob: {} });
    localStorage.setItem('sm_pinned_ids', '{broken');
    const warnings = vi.fn();
    const archive = await exportOfflineBackup(undefined, warnings);
    const files = await unpack(await readBlob(archive));
    expect(files[`${ROOT}_System/export_report.json`]).toBeDefined();
    expect(parseJson(files[`${ROOT}_System/export_report.json`])).toMatchObject({ issues: expect.arrayContaining([
      expect.objectContaining({ reason: 'invalid', detail: 'unreadable image' }),
    ]) });
    expect(warnings.mock.calls[0][0].length).toBeGreaterThan(0);
    // Even a schema-damaged record is retained as readable JSON for manual recovery.
    expect(parseJson(files[`${ROOT}_History/測試_遊戲_h1/session.json`])).toMatchObject({ players: [{ totalScore: 'broken' }] });
    const report = await importOfflineBackup(archive);
    expect(await db.history.get('h1')).toBeUndefined();
    expect(await db.history.get('healthy')).toMatchObject({ players: record.players, photos: ['missing-blob', 'unreadable-source'] });
    expect(await db.images.get('missing-blob')).toBeUndefined();
    expect(report.issues).toContainEqual(expect.objectContaining({ reason: 'invalid', detail: 'players[0].totalScore' }));
    expect(report.issues.some(issue => issue.path.includes('missing-blob'))).toBe(false);
    expect(report.issues.some(issue => issue.path.includes('unreadable-source'))).toBe(false);
  });

  it('restores other data when a declared photo is missing or corrupted and returns temporary diagnostics', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    const index = parseJson((await unpack(await readBlob(archive)))[MANIFEST]) as Manifest;
    const path = index.images.find(image => image.id === 'photo')!.path;
    for (const missing of [true, false]) {
      const damaged = await rewrite(archive, (files, manifest) => {
        const path = manifest.images.find(image => image.id === 'photo')!.path;
        if (missing) {
          delete files[path];
          manifest.missingImageIds = ['photo'];
        }
        else files[path][0] ^= 1;
      });
      const report = await importOfflineBackup(damaged);
      expect(report.issues).toEqual([{ path: path.slice(ROOT.length), reason: missing ? 'missing' : 'checksum' }]);
      expect(await db.history.get('h1')).toMatchObject({ gameName: record.gameName, players: record.players, photos: record.photos });
      expect(await db.images.get('photo')).toBeUndefined();
      expect(await db.images.count()).toBe(2);
    }
  });

  it('rolls back every table if a database write fails after earlier clears', async () => {
    await seed();
    const archive = await exportOfflineBackup();
    vi.spyOn(db.images, 'bulkAdd').mockRejectedValueOnce(new Error('write failed'));
    await expect(importOfflineBackup(archive)).rejects.toThrow('write failed');
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

  it('preserves missing photo references while isolating invalid preferences and built-in ID collisions', async () => {
    await seed();
    await db.images.delete('photo');
    const localCopy = await exportOfflineBackup();
    const restored = await validateOfflineBackup(localCopy);
    expect(restored.tables.history[0].photos).toEqual(['photo']);
    expect(restored.images.some(image => image.id === 'photo')).toBe(false);
    expect(restored.issues).toEqual([]);
    // Older ZIPs without the optional missing-ID marker still describe the
    // files they contain; a dangling reference is not a lost archive entry.
    const legacy = await rewrite(localCopy, (_files, manifest) => {
      manifest.version = 1;
      delete manifest.missingImageIds;
    });
    expect((await importOfflineBackup(legacy)).issues).toEqual([]);
    expect((await db.history.get('h1'))!.photos).toEqual(['photo']);
    await db.history.clear();
    const archive = await exportOfflineBackup();
    const badPreferences = await rewrite(archive, (_files, manifest) => { manifest.preferences.sm_pinned_ids = '{broken'; });
    const partial = await validateOfflineBackup(badPreferences);
    expect(partial.preferences).not.toHaveProperty('sm_pinned_ids');
    expect(partial.issues).toContainEqual(expect.objectContaining({ path: '_System/settings_backup.json#sm_pinned_ids', reason: 'invalid' }));
    const builtin = await rewrite(archive, async (files, manifest) => {
      const path = manifest.tables.templates[0];
      files[path] = jsonBytes({ ...template, id: 'builtin' });
      manifest.files[path] = { size: files[path].length, sha256: await digest(files[path]) };
    });
    expect((await importOfflineBackup(builtin)).issues).toContainEqual(expect.objectContaining({ path: 'templates:builtin', reason: 'invalid' }));
    expect(await db.templates.get('builtin')).toBeUndefined();
    expect(await db.builtins.get('builtin')).toEqual({ ...template, id: 'builtin' });
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

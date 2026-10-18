import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { db } from './db';
import { LanguageProvider } from './i18n';
import { ToastProvider } from './hooks/useToast';
import { ConfirmationProvider } from './hooks/useConfirm';
import { _resetActiveCountForTesting } from './hooks/useModalBackHandler';
import { applyScoreInputValue } from './components/session/scoreInputUpdate';
import { DEFAULT_TEMPLATES } from './data/templates';
import { migrateTemplate } from './utils/dataMigration';
import { createMultiplayerHostRoomRuntime } from './features/multiplayer/multiplayerRoomRuntime';
import { createMultiplayerP2PRuntimeTransport } from './features/multiplayer/multiplayerP2PRuntimeTransport';
import { createScoreStateSyncAdapter } from './features/multiplayer/scoreStateSyncAdapter';
import { multiplayerSessionManager } from './features/multiplayer/multiplayerSessionManager';
import { routeMultiplayerSessionUpdate } from './features/multiplayer/multiplayerSessionUpdateRouter';
import { createRuntimeStore, createDeliveryStore } from './test/multiplayerRuntimeFixture';
import { createHeadlessParticipant } from './test/multiplayerPeerFixture';
import type { createPeerNetwork } from './test/peerNetworkFixture';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

const fixtures = vi.hoisted(() => ({ network: null as ReturnType<typeof createPeerNetwork> | null }));

vi.mock('peerjs', async importOriginal => {
  const actual = await importOriginal<typeof import('peerjs')>();
  const { createPeerNetwork } = await import('./test/peerNetworkFixture');
  fixtures.network = createPeerNetwork(actual.util);
  return { ...actual, default: fixtures.network.Peer };
});

vi.mock('./db', async importOriginal => {
  const { default: Dexie } = await import('dexie');
  const { indexedDB, IDBKeyRange } = await import('fake-indexeddb');
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  // The actual schema runs against an isolated in-memory browser storage API.
  return importOriginal();
});

let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>> | undefined;
let headless: ReturnType<typeof createHeadlessParticipant>[] = [];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T02:00:00Z'));
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  class BrowserBlob extends Blob {
    arrayBuffer(): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    }
    text(): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    }
  }
  vi.stubGlobal('Blob', BrowserBlob);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('unexpected_external_request'); }));
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('app_language', 'en');
  localStorage.setItem('sm_builtin_data_version', '20');
  _resetActiveCountForTesting();
  fixtures.network!.errors.length = 0;
  fixtures.network!.packets.length = 0;
  await db.open();
  window.history.replaceState({}, '', '/?room=exit-test-room');
});

afterEach(async () => {
  cleanup();
  await multiplayerSessionManager.closeRoom('exit-test-room', { deleteLocalRoom: true });
  host?.stop();
  for (const participant of headless) participant.transport.stop?.();
  headless = [];
  fixtures.network!.close();
  await db.delete();
  await waitFor(() => expect((window as any).__silentBack ?? 0).toBe(0));
  _resetActiveCountForTesting();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(['mouse', 'touch'] as const)('four-device missing-board join, score sync, exit/discard/delete/start through real UI (%s)', async activation => {
  let touchId = 0;
  const tap = (element: Element) => {
    if (activation === 'touch') {
      const finger = { identifier: ++touchId, target: element, clientX: 20, clientY: 20 };
      fireEvent.touchStart(element, { touches: [finger], changedTouches: [finger] });
      fireEvent.touchEnd(element, { touches: [], changedTouches: [finger] });
    }
    fireEvent.click(element, { detail: 1, clientX: 20, clientY: 20 });
  };
  const builtin = migrateTemplate(structuredClone(DEFAULT_TEMPLATES.find(row => row.id === 'Built-in-Sweet-Lands')!));
  const board = { ...builtin, id: 'a0b1c2d3', name: 'Shared Sweet Lands' };
  // Keep normal startup from seeding every builtin, without providing any of
  // the host board's contents or game metadata to the participant.
  const unrelatedBuiltin = { id: 'unrelated-builtin', name: 'Unrelated Built-in', createdAt: 1, updatedAt: 1,
    columns: [{ id: 'unrelated', name: 'Unrelated', formula: 'a1', inputType: 'keypad' as const, isScoring: true }] };
  await db.builtins.put(unrelatedBuiltin);
  await db.templates.put({ id: 'other-board', name: 'Other board', createdAt: 1, updatedAt: 1,
    columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] });
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(await db.builtins.get(builtin.id)).toBeUndefined();
  const localBoards = [...await db.templates.toArray(), ...await db.builtins.toArray()];
  expect(localBoards.some(row => row.id === board.id || row.id === builtin.id
    || JSON.stringify(row.columns) === JSON.stringify(board.columns))).toBe(false);
  const store = createRuntimeStore();
  const adapter = createScoreStateSyncAdapter({ roomId: 'exit-test-room', role: 'host', store: {
    ...store, applyRemoteBootstrap: async () => { throw new Error('host_must_not_import'); },
  } });
  const transport = createMultiplayerP2PRuntimeTransport({ Peer: fixtures.network!.Peer, adapter,
    logger: (message, level) => { if (level === 'error') fixtures.network!.errors.push(message); } });
  host = await createMultiplayerHostRoomRuntime({ roomId: 'exit-test-room', hostDeviceId: 'host', template: board,
    session: { id: 'shared-session', templateId: board.id, name: board.name, startTime: 1, status: 'active',
      players: Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`,
        color: '#ff0000', scores: {}, totalScore: 0 })) },
    store, deliveryStore: createDeliveryStore(), transport });
  host.start();
  headless = ['p3', 'p4'].map(id => createHeadlessParticipant(fixtures.network!.Peer, 'exit-test-room', id));
  render(<LanguageProvider><ToastProvider><ConfirmationProvider><App /></ConfirmationProvider></ToastProvider></LanguageProvider>);
  await waitFor(() => expect(fixtures.network!.peerCount).toBe(4));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Player 2' }),
    `${fixtures.network!.packets.join(',')}; errors=${fixtures.network!.errors}; UI=${document.body.textContent?.slice(-600)}`).not.toBeNull(),
    // Match the real QR join's three-second deadline, rather than RTL's shorter
    // one-second default. The application's timeout remains fully active.
    { timeout: 3_000 });
  tap(screen.getByRole('button', { name: 'Player 2' }));
  tap(screen.getByRole('button', { name: 'Enter score sheet' }));
  await screen.findByRole('button', { name: 'Multiplayer room' });
  await waitFor(() => expect(host!.getParticipantClaims()).toEqual({ p2: 1, p3: 1, p4: 1 }));
  const inputColumn = board.columns.find(column => column.name === '當前分數')!;
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, inputColumn, 'p1', 5);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  const cell = document.querySelector(`[data-score-cell="p2:${inputColumn.id}"]`)!;
  tap(cell.firstElementChild!);
  const inputPanel = document.querySelector('[data-session-input-panel="true"]') as HTMLElement;
  tap(within(inputPanel).getByRole('button', { name: '7' }));
  await waitFor(() => expect(host!.session.session.players[1].scores[inputColumn.id]?.parts).toEqual([7]));
  await act(async () => {
    await Promise.all(headless.map((participant, index) => participant.runtime!.controller.queueScoreValuePatch({
      actor: { role: 'player', playerId: `p${index + 3}` }, targetPlayerId: `p${index + 3}`,
      colId: inputColumn.id, scoreValue: { parts: [9 + index * 2] },
    })));
  });
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, inputColumn, 'p1', 6);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  const expectedScores = [[6], [7], [9], [11]];
  await waitFor(() => expect(host!.session.session.players.map(player => player.scores[inputColumn.id]?.parts))
    .toEqual(expectedScores));
  await waitFor(() => expect(multiplayerSessionManager.get('exit-test-room')?.session?.players
    .map(player => player.scores[inputColumn.id]?.parts)).toEqual(expectedScores));
  await waitFor(() => expect(headless.map(participant => participant.runtime!.session.session.players
    .map(player => player.scores[inputColumn.id]?.parts))).toEqual([expectedScores, expectedScores]));
  await waitFor(async () => expect((await db.sessions.get('shared-session'))?.players
    .map(player => player.scores[inputColumn.id]?.parts)).toEqual(expectedScores));
  // The real SessionView and input panel are retained; no direct discard/start calls.
  expect(await db.templates.get(board.id)).toMatchObject({ id: board.id, name: board.name });
  expect(await db.builtins.get(builtin.id)).toBeUndefined();
  tap(screen.getByRole('button', { name: 'Multiplayer room' }));
  tap(screen.getByRole('button', { name: 'Leave multiplayer room' }));
  await waitFor(() => expect(multiplayerSessionManager.get('exit-test-room')).toBeNull());
  await waitFor(() => expect(host!.getParticipantClaims()).toEqual({ p3: 1, p4: 1 }));
  // The header's back control has no accessible name in the current UI.
  tap(document.querySelector('svg.lucide-arrow-left')!.closest('button')!);
  await screen.findByText('Return to Menu');
  tap(screen.getByRole('button', { name: 'Discard' }));
  await screen.findByText('Discard Game?');
  tap(within(screen.getByText('Discard Game?').closest('.modal-container') as HTMLElement)
    .getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await db.sessions.get('shared-session')).toBeUndefined());
  const boardName = await screen.findByText(board.name, { exact: true });
  const card = boardName.closest('[data-card-id]') ?? boardName.closest('.group');
  expect(card).not.toBeNull();
  tap(card!.querySelector('svg.lucide-trash-2')!.closest('button')!);
  await screen.findByText('Delete this template?');
  tap(within(screen.getByText('Delete this template?').closest('.modal-container') as HTMLElement)
    .getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await db.templates.get(board.id)).toBeUndefined());
  tap(await screen.findByText('Other board', { exact: true }));
  tap(screen.getByRole('button', { name: 'Start Scoring' }));
  await screen.findByText('Points', { exact: true });
  const localCell = document.querySelector('[data-score-cell="player_1:points"]')!;
  tap(localCell.firstElementChild!);
  tap(within(document.querySelector('[data-session-input-panel="true"]') as HTMLElement)
    .getByRole('button', { name: '5' }));
  await waitFor(() => expect(localCell.textContent).toContain('5'));
  tap(document.querySelector('svg.lucide-arrow-left')!.closest('button')!);
  await screen.findByText('Return to Menu');
  tap(screen.getByRole('button', { name: 'Discard' }));
  await screen.findByText('Discard Game?');
  tap(within(screen.getByText('Discard Game?').closest('.modal-container') as HTMLElement)
    .getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Points', { exact: true })).toBeNull());
  await waitFor(async () => expect(await db.sessions.count()).toBe(0));
  expect(fixtures.network!.errors).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
}, 10_000);

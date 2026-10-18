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
import { multiplayerLocalStore } from './features/multiplayer/multiplayerLocalStore';
import { createMultiplayerHostRoomRuntime } from './features/multiplayer/multiplayerRoomRuntime';
import { createMultiplayerP2PRuntimeTransport } from './features/multiplayer/multiplayerP2PRuntimeTransport';
import { createScoreStateSyncAdapter } from './features/multiplayer/scoreStateSyncAdapter';
import { multiplayerSessionManager, type ManagedMultiplayerRuntime } from './features/multiplayer/multiplayerSessionManager';
import { routeMultiplayerSessionUpdate } from './features/multiplayer/multiplayerSessionUpdateRouter';
import { createRuntimeStore, createDeliveryStore } from './test/multiplayerRuntimeFixture';
import { createHeadlessParticipant } from './test/multiplayerPeerFixture';
import type { createPeerNetwork } from './test/peerNetworkFixture';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import type { GameSession } from './types';

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
let renderedRuntime: ManagedMultiplayerRuntime | undefined;
let headless: ReturnType<typeof createHeadlessParticipant>[] = [];
let packetGates: Array<{ release: (options?: { deliverAfterClose?: boolean }) => void }> = [];
let persistenceRelease: (() => void) | undefined;
let persistenceSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(async () => {
  renderedRuntime = undefined;
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
  try {
    packetGates.forEach(gate => gate.release());
    packetGates = [];
    persistenceRelease?.();
    persistenceRelease = undefined;
    persistenceSpy?.mockRestore();
    persistenceSpy = undefined;
    cleanup();
    // Older implementations did not register cleanup until after draining the
    // runtime. Drain our saved reference before deleting the test database too.
    await renderedRuntime?.whenIdle?.();
    await multiplayerSessionManager.closeRoom('exit-test-room', { deleteLocalRoom: true });
    await multiplayerSessionManager.waitForRoomCleanup('exit-test-room');
    host?.stop();
    for (const participant of headless) {
      participant.runtime?.stop();
      participant.transport.stop?.();
    }
    headless = [];
    fixtures.network!.close();
    await db.delete();
    await waitFor(() => expect((window as any).__silentBack ?? 0).toBe(0));
    _resetActiveCountForTesting();
    expect(fixtures.network!.errors).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

const createTouchTap = () => {
  let touchId = 0;
  return (element: Element) => {
    const finger = { identifier: ++touchId, target: element, clientX: 20, clientY: 20 };
    fireEvent.touchStart(element, { touches: [finger], changedTouches: [finger] });
    fireEvent.touchEnd(element, { touches: [], changedTouches: [finger] });
    fireEvent.click(element, { detail: 1, clientX: 20, clientY: 20 });
  };
};

async function openFourDeviceRoom(tap: (element: Element) => void, extraFormula?: 'a1+next' | 'a1×a2+next') {
  const builtin = migrateTemplate(structuredClone(DEFAULT_TEMPLATES.find(row => row.id === 'Built-in-Sweet-Lands')!));
  const extraColumn = extraFormula ? [{ id: 'exit-draft', name: 'Exit draft', formula: extraFormula,
    inputType: 'keypad' as const, isScoring: true,
    ...(extraFormula.includes('×') ? { subUnits: ['A', 'B'] as [string, string] } : {}) }] : [];
  const board = { ...builtin, id: 'a0b1c2d3', name: 'Shared Sweet Lands', columns: [...builtin.columns, ...extraColumn] };
  await db.builtins.put({ id: 'unrelated-builtin', name: 'Unrelated Built-in', createdAt: 1, updatedAt: 1,
    columns: [{ id: 'unrelated', name: 'Unrelated', formula: 'a1', inputType: 'keypad' as const, isScoring: true }] });
  await db.templates.put({ id: 'other-board', name: 'Other board', createdAt: 1, updatedAt: 1,
    columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] });
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(await db.builtins.get(builtin.id)).toBeUndefined();
  expect([...(await db.templates.toArray()), ...(await db.builtins.toArray())]
    .some(row => row.id === board.id || row.id === builtin.id || JSON.stringify(row.columns) === JSON.stringify(board.columns))).toBe(false);
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
  await waitFor(() => expect(fixtures.network!.peerCount).toBe(4), { timeout: 3_000 });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Player 2' })).not.toBeNull(), { timeout: 3_000 });
  const enter = screen.getByRole('button', { name: 'Enter score sheet' });
  await waitFor(async () => {
    if (!enter.hasAttribute('disabled')) return;
    await act(async () => { tap(screen.getByRole('button', { name: 'Player 2' })); });
    expect(enter).toBeEnabled();
  }, { timeout: 3_000 });
  tap(enter);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Multiplayer room' })).not.toBeNull(), {
    timeout: 3_000,
    onTimeout: () => new Error(`join did not enter score sheet: ${JSON.stringify({
      room: multiplayerSessionManager.get('exit-test-room')?.status,
      claims: host?.getParticipantClaims(),
      history: window.history.state,
      text: document.body.textContent?.slice(-1200),
      errors: fixtures.network!.errors,
    })}`),
  });
  renderedRuntime = multiplayerSessionManager.get('exit-test-room')?.runtime ?? undefined;
  await waitFor(() => expect(host!.getParticipantClaims()).toEqual({ p2: 1, p3: 1, p4: 1 }));
  const scoreColumn = board.columns.find(column => column.name === '當前分數')!;
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, scoreColumn, 'p1', 5);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  tap(document.querySelector(`[data-score-cell="p2:${scoreColumn.id}"]`)!.firstElementChild!);
  const panel = within(document.querySelector('[data-session-input-panel="true"]')!);
  tap(await panel.findByRole('button', { name: '7' }));
  await waitFor(() => expect(host!.session.session.players[1].scores[scoreColumn.id]?.parts).toEqual([7]));
  await act(async () => {
    await Promise.all(headless.map((participant, index) => participant.runtime!.controller.queueScoreValuePatch({
      actor: { role: 'player', playerId: `p${index + 3}` }, targetPlayerId: `p${index + 3}`,
      colId: scoreColumn.id, scoreValue: { parts: [9 + index * 2] },
    })));
  });
  await waitForScoreConvergence(scoreColumn.id, [[5], [7], [9], [11]]);
  // Leave the p2 keypad through the same real cell interaction used by the app.
  tap(document.querySelector(`[data-score-cell="p2:${scoreColumn.id}"]`)!.firstElementChild!);
  return { board, builtin };
}

const scoreParts = (session: GameSession | undefined, colId: string) => session?.players
  .map(player => player.scores[colId]?.parts);

async function waitForScoreConvergence(colId: string, expected: number[][]) {
  await waitFor(() => {
    expect(scoreParts(host!.session.session, colId)).toEqual(expected);
    expect(scoreParts(multiplayerSessionManager.get('exit-test-room')?.session, colId)).toEqual(expected);
    for (const participant of headless) expect(scoreParts(participant.runtime?.session.session, colId)).toEqual(expected);
  });
  await waitFor(async () => expect(scoreParts(await db.sessions.get('shared-session'), colId)).toEqual(expected));
  await act(async () => {
    await fixtures.network!.flush();
    await Promise.all([host!.whenIdle?.(), multiplayerSessionManager.get('exit-test-room')?.runtime?.whenIdle?.(),
      ...headless.map(participant => participant.runtime?.whenIdle?.())]);
  });
}

async function leaveAndDiscardRoom(tap: (element: Element) => void) {
  tap(screen.getByRole('button', { name: 'Multiplayer room' }));
  tap(screen.getByRole('button', { name: 'Leave multiplayer room' }));
  await waitFor(() => expect(multiplayerSessionManager.get('exit-test-room')).toBeNull());
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Leave multiplayer room' })).toBeNull(), {
    onTimeout: () => new Error('room runtime was removed, but the leave dialog still waits for unfinished local work'),
  });
  await waitFor(() => expect(host!.getParticipantClaims()).toEqual({ p3: 1, p4: 1 }));
  tap(document.querySelector('svg.lucide-arrow-left')!.closest('button')!);
  await screen.findByText('Return to Menu');
  tap(screen.getByRole('button', { name: 'Discard' }));
  await screen.findByText('Discard Game?');
  tap(within(screen.getByText('Discard Game?').closest('.modal-container') as HTMLElement)
    .getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await db.sessions.get('shared-session')).toBeUndefined());
}

async function assertDiscardDeleteAndStart(tap: (element: Element) => void, board: { id: string; name: string }) {
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
  await waitFor(() => expect(document.querySelector('[data-score-cell="player_1:points"]')).not.toBeNull());
  tap(document.querySelector('[data-score-cell="player_1:points"]')!.firstElementChild!);
  tap(await within(document.querySelector('[data-session-input-panel="true"]')!).findByRole('button', { name: '5' }));
  await waitFor(() => expect(document.querySelector('[data-score-cell="player_1:points"]')?.textContent).toContain('5'));
  await discardStartedLocalGame(tap);
  expect(screen.queryByText('Delete failed, please try again')).toBeNull();
}

async function discardStartedLocalGame(tap: (element: Element) => void) {
  tap(document.querySelector('svg.lucide-arrow-left')!.closest('button')!);
  await screen.findByText('Return to Menu');
  tap(screen.getByRole('button', { name: 'Discard' }));
  await screen.findByText('Discard Game?');
  tap(within(screen.getByText('Discard Game?').closest('.modal-container') as HTMLElement)
    .getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Points', { exact: true })).toBeNull());
  await waitFor(async () => expect(await db.sessions.count()).toBe(0));
}

function holdUntil(predicate: (packet: { from: string; to: string; message: any }) => boolean) {
  const gate = fixtures.network!.holdPackets(predicate);
  packetGates.push(gate);
  return gate;
}

async function identifyP2Peer(tap: (element: Element) => void, colId: string) {
  let peerId: string | undefined;
  const gate = holdUntil(packet => {
    if (packet.message?.type !== 'score:valuePatch' || packet.message.patch?.actor?.playerId !== 'p2') return false;
    peerId = packet.from;
    return true;
  });
  tap(document.querySelector(`[data-score-cell="p2:${colId}"]`)!.firstElementChild!);
  const panel = within(document.querySelector('[data-session-input-panel="true"]')!);
  tap(await panel.findByRole('button', { name: '8' }));
  await waitFor(() => expect(gate.heldCount).toBeGreaterThan(0));
  await act(async () => {
    gate.release();
    await fixtures.network!.flush();
  });
  await waitForScoreConvergence(colId, [[5], [8], [9], [11]]);
  tap(document.querySelector(`[data-score-cell="p2:${colId}"]`)!.firstElementChild!);
  return peerId!;
}

it('touch exit drops a p2 score:valuePatch held before the host receives it', async () => {
  const tap = createTouchTap();
  const { board } = await openFourDeviceRoom(tap);
  const col = board.columns.find(column => column.name === '當前分數')!;
  const gate = holdUntil(packet => packet.message?.type === 'score:valuePatch'
    && packet.message.patch?.actor?.playerId === 'p2');
  const cell = document.querySelector(`[data-score-cell="p2:${col.id}"]`)!;
  tap(cell.firstElementChild!);
  tap(await within(document.querySelector('[data-session-input-panel="true"]')!).findByRole('button', { name: '8' }));
  await waitFor(() => expect(gate.heldCount).toBeGreaterThan(0));
  await waitFor(() => expect(host!.session.session.players[1].scores[col.id]?.parts).toEqual([7]));
  await leaveAndDiscardRoom(tap);
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  await assertDiscardDeleteAndStart(tap, board);
  gate.release();
  await fixtures.network!.flush();
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(fixtures.network!.errors).toEqual([]);
}, 10_000);

it('touch exit drops the accepted host score:patch-result held before p2 receives it', async () => {
  const tap = createTouchTap();
  const { board } = await openFourDeviceRoom(tap);
  const col = board.columns.find(column => column.name === '當前分數')!;
  const target = await identifyP2Peer(tap, col.id);
  const gate = holdUntil(packet => {
    return packet.to === target && packet.message?.type === 'score:patch-result' && packet.message.accepted === true;
  });
  const cell = document.querySelector(`[data-score-cell="p2:${col.id}"]`)!;
  tap(cell.firstElementChild!);
  tap(await within(document.querySelector('[data-session-input-panel="true"]')!).findByRole('button', { name: '9' }));
  await waitFor(() => expect(gate.heldCount).toBeGreaterThan(0));
  await waitFor(() => expect(host!.session.session.players[1].scores[col.id]?.parts).toEqual([9]));
  if (renderedRuntime?.role !== 'player') throw new Error('expected_participant_runtime');
  expect(renderedRuntime.session.confirmedSession.players[1].scores[col.id]?.parts).toEqual([8]);
  await leaveAndDiscardRoom(tap);
  await assertDiscardDeleteAndStart(tap, board);
  gate.release();
  await fixtures.network!.flush();
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(screen.queryByText(board.name, { exact: true })).toBeNull();
}, 10_000);

it.each([false, true])('touch exit ignores a delayed host snapshot (queued callback after close: %s)', async deliverAfterClose => {
  const tap = createTouchTap();
  const { board } = await openFourDeviceRoom(tap);
  const col = board.columns.find(column => column.name === '當前分數')!;
  const p2Peer = await identifyP2Peer(tap, col.id);
  // identifyP2Peer closes the panel after its settled score; open it and keep
  // the keypad draft untouched while the host publishes p1's edit.
  tap(document.querySelector(`[data-score-cell="p2:${col.id}"]`)!.firstElementChild!);
  await within(document.querySelector('[data-session-input-panel="true"]')!).findByRole('button', { name: '7' });
  const gate = holdUntil(packet => packet.from === 'exit-test-room' && packet.to === p2Peer
    && packet.message?.type === 'session:snapshot' && packet.message.session?.players?.[0]?.scores?.[col.id]?.parts?.[0] === 6);
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, col, 'p1', 6);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  await waitFor(() => expect(gate.heldCount).toBeGreaterThan(0));
  await leaveAndDiscardRoom(tap);
  await assertDiscardDeleteAndStart(tap, board);
  gate.release({ deliverAfterClose });
  await fixtures.network!.flush();
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(screen.queryByText(board.name, { exact: true })).toBeNull();
}, 10_000);

it.each(['a1+next', 'a1×a2+next'] as const)('touch exit discards an uncommitted %s keypad draft', async formula => {
  const tap = createTouchTap();
  const { board } = await openFourDeviceRoom(tap, formula);
  const col = board.columns.find(column => column.id === 'exit-draft')!;
  const sessionBefore = await db.sessions.get('shared-session');
  expect(sessionBefore).toBeDefined();
  tap(document.querySelector(`[data-score-cell="p2:${col.id}"]`)!.firstElementChild!);
  const panelElement = document.querySelector<HTMLElement>('[data-session-input-panel="true"]')!;
  const panel = within(panelElement);
  if (formula.includes('×')) {
    tap(panel.getByRole('button', { name: '2' }));
    const secondFactor = Array.from(panelElement.querySelectorAll('div'))
      .find(element => element.classList.contains('cursor-pointer') && element.textContent?.trim() === '1');
    expect(secondFactor).toBeDefined();
    tap(secondFactor!);
    tap(panel.getByRole('button', { name: '3' }));
    const factors = Array.from(panelElement.querySelectorAll<HTMLDivElement>('div.cursor-pointer'))
      .filter(element => element.classList.contains('bg-brand-primary/10'));
    expect(factors.map(element => element.textContent?.trim())).toEqual(['2', '3']);
  } else {
    tap(panel.getByRole('button', { name: '4' }));
    expect(Array.from(panelElement.querySelectorAll('span.font-mono')).some(element => element.textContent === '4')).toBe(true);
  }
  expect((await db.sessions.get('shared-session'))?.players[1].scores[col.id]).toBeUndefined();
  await leaveAndDiscardRoom(tap);
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  await assertDiscardDeleteAndStart(tap, board);
  expect(await db.templates.get(board.id)).toBeUndefined();
}, 10_000);

// Before ad44673, whenIdle blocked the leave dialog even with nonblocking
// cleanup requested. Fixing only that exposed cleanupService's id/roomId bug
// while the old room row remained pending. This full flow covers both defects.
it('touch exit keeps the session deleted when received snapshot persistence resumes afterward', async () => {
  const tap = createTouchTap();
  const { board } = await openFourDeviceRoom(tap);
  const col = board.columns.find(column => column.name === '當前分數')!;
  const playerRuntime = multiplayerSessionManager.get('exit-test-room')!.runtime!;
  const original = multiplayerLocalStore.persistSnapshot!;
  let startedResolve!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { startedResolve = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; persistenceRelease = resolve; });
  let pendingWrite: Promise<unknown> | undefined;
  persistenceSpy = vi.spyOn(multiplayerLocalStore, 'persistSnapshot').mockImplementation(options => {
    if (options.session.players[0].scores[col.id]?.parts[0] !== 6) return original(options);
    // Pause before starting the transaction, not while holding a database lock.
    pendingWrite = held.then(() => original(options));
    startedResolve();
    return pendingWrite;
  });
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, col, 'p1', 6);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  await started;
  expect(persistenceSpy).toHaveBeenCalledTimes(1);
  await leaveAndDiscardRoom(tap);
  // Even template deletion and another game's lifecycle must work while the
  // abandoned receive task is still paused and the old room row still exists.
  await assertDiscardDeleteAndStart(tap, board);
  release();
  persistenceRelease = undefined;
  await pendingWrite;
  await playerRuntime.whenIdle?.();
  await multiplayerSessionManager.waitForRoomCleanup('exit-test-room');
  persistenceSpy.mockRestore();
  persistenceSpy = undefined;
  expect(await db.sessions.get('shared-session')).toBeUndefined();
  expect(await db.templates.get(board.id)).toBeUndefined();
  expect(screen.queryByText(board.name, { exact: true })).toBeNull();
}, 10_000);

it.each(['mouse', 'touch'] as const)('four-device missing-board join, score sync, exit/discard/delete/start through real UI (%s)', async activation => {
  const tap = activation === 'touch' ? createTouchTap() : (element: Element) => fireEvent.click(element, { detail: 1, clientX: 20, clientY: 20 });
  const { board, builtin } = await openFourDeviceRoom(tap);
  const inputColumn = board.columns.find(column => column.name === '當前分數')!;
  await act(async () => {
    const previous = host!.session.session;
    const next = applyScoreInputValue(previous, inputColumn, 'p1', 6);
    await routeMultiplayerSessionUpdate({ previous, next, runtime: host! });
  });
  const expectedScores = [[6], [7], [9], [11]];
  await waitForScoreConvergence(inputColumn.id, expectedScores);
  // The real SessionView and input panel are retained; no direct discard/start calls.
  expect(await db.templates.get(board.id)).toMatchObject({ id: board.id, name: board.name });
  expect(await db.builtins.get(builtin.id)).toBeUndefined();
  tap(document.querySelector(`[data-score-cell="p2:${inputColumn.id}"]`)!.firstElementChild!);
  await leaveAndDiscardRoom(tap);
  await assertDiscardDeleteAndStart(tap, board);
  expect(fixtures.network!.errors).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
}, 10_000);

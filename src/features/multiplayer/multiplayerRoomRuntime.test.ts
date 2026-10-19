import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TEMPLATES } from '../../data/templates';
import { migrateTemplate } from '../../utils/dataMigration';
import { applyScoreInputValue } from '../../components/session/scoreInputUpdate';
import { createMultiplayerHostSession } from './multiplayerSession';
import { GameSession, GameTemplate, ScoreColumn, ScoreValue } from '../../types';
import { getEffectiveIds } from '../../utils/scoring';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { saveParticipantBinding } from './multiplayerParticipantBinding';
import { MultiplayerRoomRuntimeTransport, createMultiplayerHostRoomRuntime, createMultiplayerPlayerRoomRuntime, restoreMultiplayerHostRoomRuntime, restoreMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { routeMultiplayerSessionUpdate } from './multiplayerSessionUpdateRouter';
import { isScoreValuePatchMessage } from './protocol';
import { createRuntimeStore, createDeliveryStore, createBindingStore, throughPeerJs } from '../../test/multiplayerRuntimeFixture';

const column: ScoreColumn = { id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none' };
const template: GameTemplate = { id: 'template-1', name: 'Template', columns: [column], createdAt: 1, updatedAt: 1 };
const session: GameSession = {
  id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 1, status: 'active',
  players: [{ id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 }],
};

describe('multiplayer room runtime', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('relays four-player Sweet Lands UI inputs and locally derives totals across real PeerJS serialization', async () => {
    const board = migrateTemplate(JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.find(row => row.id === 'Built-in-Sweet-Lands'))));
    const boardSession: GameSession = { ...session, templateId: board.id, name: board.name,
      scoringRule: 'HIGHEST_WINS', players: Array.from({ length: 4 }, (_, index) => ({
        id: `p${index + 1}`, name: `P${index + 1}`, color: '#fff', scores: {}, totalScore: 0,
      })) };
    const hostStore = createRuntimeStore();
    const clients = new Map<object, Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>>();
    const deliveries: MultiplayerDeliveryStore[] = [];
    const clientStores: ReturnType<typeof createRuntimeStore>[] = [];
    const transfers: Promise<unknown>[] = [];
    const deliver = (message: unknown, receiver: (message: unknown) => Promise<unknown>) => {
      const packet = throughPeerJs(message);
      const task = Promise.resolve().then(() => receiver(packet));
      transfers.push(task);
      void task.catch(() => undefined); // The original rejection is checked by flush.
      return true;
    };
    const flush = async () => {
      for (let wave = 0; transfers.length; wave++) {
        if (wave > 50) throw new Error('Unexpected sync loop');
        await Promise.all(transfers.splice(0));
      }
    };
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host',
      template: board, session: boardSession, store: hostStore, deliveryStore: createDeliveryStore(),
      transport: { sendToHost: () => false, broadcastLocalChanges: async () => undefined,
        sendToConnection: (connection, message) => deliver(message, packet => clients.get(connection as object)!.receive(packet)),
        broadcastMessage: (message, exceptConnection) => {
          for (const [connection, client] of clients) {
            if (connection !== exceptConnection) deliver(message, packet => client.receive(packet));
          }
          return true;
        },
      } });
    try {
      for (let index = 1; index < 4; index++) {
        const connection = {};
        const deliveryStore = createDeliveryStore();
        const store = createRuntimeStore();
        const client = await createMultiplayerPlayerRoomRuntime({
          bootstrapMessage: host.session.createBootstrapMessage(), deviceId: `device-${index}`,
          store, deliveryStore, bindingStore: createBindingStore(),
          transport: { sendToConnection: () => false, broadcastLocalChanges: async () => undefined,
            sendToHost: message => deliver(message, packet => host.receive(packet, connection)),
          },
        });
        clients.set(connection, client);
        deliveries.push(deliveryStore);
        clientStores.push(store);
        client.controller.claimPlayer(`p${index + 1}`);
      }
      await flush();
      expect(host.getParticipantClaims()).toEqual({ p2: 1, p3: 1, p4: 1 });

      const ends = [host, ...clients.values()];
      await Promise.all(ends.map(async (runtime, index) => {
        const playerId = `p${index + 1}`;
        const inputs: Array<[string, Parameters<typeof applyScoreInputValue>[3]]> = [
          ['當前分數', (index + 1) * 10],
          ['地形軌', { optionId: board.columns.find(col => col.name === '地形軌')!.quickActions!
            .find(action => action.label === ['2個1分', '1個1分', '3個1分', '2個1分'][index])!.id }],
          ['地形板塊', [5, 7, 8, 9][index]],
          ['餅乾兔軌', { optionId: board.columns.find(col => col.name === '餅乾兔軌')!.quickActions!
            .find(action => action.label === ['1個4分', '1個5分', '1個7分', '1個4分'][index])!.id }],
          ['餅乾兔', index + 2],
          ['5座帳篷', { optionId: board.columns.find(col => col.name === '5座帳篷')!.quickActions!
            .find(action => action.label === (index % 2 === 0 ? '達成' : '未滿'))!.id }],
        ];
        for (const [name, value] of inputs) {
          const col = board.columns.find(row => row.name === name)!;
          const previous = runtime.session.session;
          const next = applyScoreInputValue(previous, col, playerId, value);
          // Exercise the message boundary independently of the now-clean UI
          // producer, as callers may still hold an older score object.
          if (index === 1 && name === '當前分數') {
            next.players[index].scores[col.id] = { ...next.players[index].scores[col.id],
              optionId: undefined, multiOptionIds: undefined };
          }
          await routeMultiplayerSessionUpdate({ previous,
            next, runtime, claimedPlayerIds: [playerId] });
        }
      }));
      await flush();
      // Independently expected: current score + terrain + rabbits + tent bonus.
      const expectedTotals = [24, 42, 68, 64];
      for (const runtime of ends) {
        expect(runtime.session.session.players.map(player => player.totalScore)).toEqual(expectedTotals);
        expect(runtime.session.session.winnerIds).toEqual(['p3']);
        expect(runtime.session.session.players.map(player => player.scores))
          .toStrictEqual(host.session.session.players.map(player => player.scores));
      }
      for (let index = 0; index < deliveries.length; index++) {
        expect(await deliveries[index].listOutbox('room-1', boardSession.id)).toHaveLength(0);
        expect((await clientStores[index].getSession(boardSession.id))!.players.map(player => player.totalScore)).toEqual(expectedTotals);
      }
    } finally {
      host.stop();
      for (const client of clients.values()) client.stop();
    }
  });

  it('permits fresh hosting before autosave and a first participant import into an empty store', async () => {
    const hostStore = createRuntimeStore();
    const transport = { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined };
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host', template, session,
      store: hostStore, transport, deliveryStore: createDeliveryStore() });
    expect(await hostStore.getSession(session.id)).toMatchObject({ id: session.id, status: 'active' });
    const store = createRuntimeStore();
    const participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'guest',
      store, transport, deliveryStore: createDeliveryStore(), bindingStore: createBindingStore() });
    expect(await store.getSession(session.id)).toMatchObject({ id: session.id, status: 'active' });
    host.stop();
    participant.stop();
  });

  it.each(['host', 'player'] as const)('does not recreate a %s game deleted after restoration reads but before its transaction', async role => {
    const store = createRuntimeStore();
    const transport = { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined };
    const deliveryStore = createDeliveryStore();
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host', template, session, store, transport, deliveryStore });
    host.stop();
    const bindingStore = createBindingStore();
    if (role === 'player') {
      const participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'guest',
        store, transport, deliveryStore, bindingStore });
      participant.stop();
    }
    const persist = store.persistBootstrap;
    vi.spyOn(store, 'persistBootstrap').mockImplementationOnce(async records => {
      await store.deleteSession(session.id);
      return persist(records);
    });
    const restoring = role === 'host' ? restoreMultiplayerHostRoomRuntime({ roomId: 'room-1', store, transport, deliveryStore })
      : restoreMultiplayerPlayerRoomRuntime({ roomId: 'room-1', deviceId: 'guest', store, transport, deliveryStore, bindingStore });
    await expect(restoring).rejects.toThrow(role === 'host' ? 'room_session_missing' : 'room_stopped');
    expect(await store.getSession(session.id)).toBeUndefined();
  });

  it('does not read or import data when participant creation is already cancelled', async () => {
    const store = createRuntimeStore();
    const getTemplate = vi.spyOn(store, 'getTemplate');
    const persistBootstrap = vi.spyOn(store, 'persistBootstrap');
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    await expect(createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), shouldPersist: () => false,
      deviceId: 'guest', store, bindingStore: createBindingStore(), deliveryStore: createDeliveryStore(),
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined } })).rejects.toThrow('room_stopped');
    expect(getTemplate).not.toHaveBeenCalled();
    expect(persistBootstrap).not.toHaveBeenCalled();
  });

  it.each([false, true])('does not recreate a deleted game during template reads (runtime stopped: %s)', async stopped => {
    const store = createRuntimeStore();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const onSessionSnapshot = vi.fn();
    const participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'guest',
      store, deliveryStore: createDeliveryStore(), bindingStore: createBindingStore(), onSessionSnapshot,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined } });
    const readTemplate = store.getTemplate;
    let started!: () => void;
    let release!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(store, 'getTemplate').mockImplementationOnce(async id => { started(); await blocked; return readTemplate(id); });
    const persist = vi.spyOn(store, 'persistBootstrap');
    host.applyLocalBoard({ ...template, name: 'Changed', updatedAt: 2 }, { ...host.session, name: 'Changed' });
    const receiving = participant.receive(host.createBootstrapMessage());
    await reading;
    await store.deleteSession(session.id);
    if (stopped) participant.stop();
    release();
    expect(await receiving).toBe(false);
    await participant.whenIdle?.();
    expect(await store.getSession(session.id)).toBeUndefined();
    expect(await store.getTemplate(template.id)).toMatchObject({ name: 'Template' });
    expect(persist).toHaveBeenCalledTimes(stopped ? 0 : 1);
    expect(onSessionSnapshot).not.toHaveBeenCalled();
    participant.stop();
  });

  it('cancels queued remote and stopped media persistence while preserving the local projection on participant exit', async () => {
    const store = createRuntimeStore();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const onSessionSnapshot = vi.fn();
    const onOwnershipReturned = vi.fn();
    const sendToHost = vi.fn(() => false);
    const participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'guest',
      store, deliveryStore: createDeliveryStore(), bindingStore: createBindingStore(), onSessionSnapshot, onOwnershipReturned,
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined } });
    let started!: () => void;
    let release!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const save = store.putSession;
    const putSession = vi.spyOn(store, 'putSession').mockImplementationOnce(async value => { started(); await blocked; await save(value); });
    const firstSnapshot = host.applyLocalSession({ ...host.session, players: [{ ...session.players[0], scores: { points: { parts: [1] } } }] })!;
    const first = participant.receive(firstSnapshot);
    await writing;
    const media = participant.controller.applyLocalSessionMedia({ ...session, photos: ['local-photo'],
      photoContentIds: { 'local-photo': 'local-content' } });
    expect(participant.session.session).toMatchObject({ photos: ['local-photo'],
      photoContentIds: { 'local-photo': 'local-content' }, players: [{ totalScore: 1, scores: { points: { parts: [1] } } }] });
    host.applyLocalBoard({ ...template, name: 'Changed' }, host.session);
    const queued = [participant.receive(firstSnapshot), participant.receive(host.createBootstrapMessage()), participant.receive(host.complete())];
    participant.stop();
    release();
    expect(await first).toBe(false);
    expect(await Promise.all(queued)).toEqual([false, false, false]);
    expect(await media).toBeNull();
    await participant.whenIdle?.();
    const persisted = await store.getSession(session.id);
    expect(persisted).toMatchObject({ status: 'active', players: [{ totalScore: 1, scores: { points: { parts: [1] } } }] });
    expect(persisted).not.toHaveProperty('photos');
    expect(persisted).not.toHaveProperty('photoContentIds');
    expect(putSession).toHaveBeenCalledTimes(1);
    expect(onSessionSnapshot).not.toHaveBeenCalled();
    expect(onOwnershipReturned).not.toHaveBeenCalled();
    expect(sendToHost).not.toHaveBeenCalled();
  });

  it('does not report a live template import after its notification closes the room', async () => {
    const store = createRuntimeStore();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    let participant!: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const onSessionSnapshot = vi.fn(() => { participant.stop(); });
    participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'guest',
      store, deliveryStore: createDeliveryStore(), bindingStore: createBindingStore(), onSessionSnapshot,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined } });
    host.applyLocalBoard({ ...template, name: 'Changed' }, { ...host.session, name: 'Changed' });
    expect(await participant.receive(host.createBootstrapMessage())).toBe(false);
    expect(onSessionSnapshot).toHaveBeenCalledOnce();
    // The already-committed update remains valid; only a late UI resume is cancelled.
    expect(await store.getSession(session.id)).toMatchObject({ name: 'Changed' });
  });

  it('does not return deleted game ownership when completion was already awaiting local template data', async () => {
    const store = createRuntimeStore();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const onOwnershipReturned = vi.fn();
    const participant = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'guest',
      store, deliveryStore: createDeliveryStore(), bindingStore: createBindingStore(), onOwnershipReturned,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined } });
    let started!: () => void;
    let release!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const readTemplate = store.getTemplate;
    vi.spyOn(store, 'getTemplate').mockImplementationOnce(async id => { started(); await blocked; return readTemplate(id); });
    const receiving = participant.receive(host.complete());
    await reading;
    await store.deleteSession(session.id);
    release();
    await receiving;
    await participant.whenIdle?.();
    expect(await store.getSession(session.id)).toBeUndefined();
    expect(await store.getRoom('room-1')).toBeUndefined();
    expect(onOwnershipReturned).not.toHaveBeenCalled();
  });

  it.each(['host', 'player'] as const)('drains already-started %s photo writes but rejects late callbacks without overwriting newer local scores', async role => {
    const store = createRuntimeStore();
    const onSessionSnapshot = vi.fn();
    const options = {
      store, deliveryStore: createDeliveryStore(), onSessionSnapshot,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
    };
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const runtime = role === 'host'
      ? await createMultiplayerHostRoomRuntime({ ...options, roomId: 'room-1', hostDeviceId: 'host', template, session })
      : await createMultiplayerPlayerRoomRuntime({ ...options, bootstrapMessage: host.createBootstrapMessage(), deviceId: 'device', bindingStore: createBindingStore() });
    let started!: () => void;
    let release!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const save = store.putSession;
    const saveSpy = vi.spyOn(store, 'putSession').mockImplementationOnce(async value => {
      started();
      await blocked;
      await save(value);
    });
    const previous = runtime.session.session;
    const admitted = routeMultiplayerSessionUpdate({ previous,
      next: { ...previous, photos: ['photo'], photoContentIds: { photo: 'before-stop' } }, runtime, mediaOnly: true });
    await writing;
    runtime.stop();
    const drained = vi.fn();
    const idle = runtime.whenIdle?.().then(drained);
    await Promise.resolve();
    expect(drained).not.toHaveBeenCalled();
    release();
    await idle;
    expect(drained).toHaveBeenCalledOnce();
    expect(await admitted).toBeNull();
    expect(onSessionSnapshot).not.toHaveBeenCalled();
    expect(await store.getSession(session.id)).toMatchObject({ photoContentIds: { photo: 'before-stop' } });
    saveSpy.mockRestore();
    onSessionSnapshot.mockClear();
    const newer = { ...previous, players: [{ ...previous.players[0], scores: { points: { parts: [9] } }, totalScore: 9 }] };
    await store.putSession(newer);
    const putSession = vi.spyOn(store, 'putSession');
    const result = await routeMultiplayerSessionUpdate({ previous,
      next: { ...previous, photos: ['photo'], photoContentIds: { photo: 'v2' } }, runtime, mediaOnly: true });
    expect(result).toBeNull();
    expect(await store.getSession(session.id)).toEqual(newer);
    expect(putSession).not.toHaveBeenCalled();
    expect(onSessionSnapshot).not.toHaveBeenCalled();
  });

  it('cancels a pending automatic template transfer when the host runtime stops', async () => {
    vi.useFakeTimers();
    const broadcast = vi.fn(async () => undefined);
    const stop = vi.fn();
    const runtime = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host', template, session,
      store: createRuntimeStore(), deliveryStore: createDeliveryStore(),
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: broadcast, stop },
    });
    await runtime.controller.applyLocalBoard({ ...template, name: 'Changed' }, session);
    runtime.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await runtime.whenIdle?.();
    expect(broadcast).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('adapts pending, restored and late inputs after a selection mode change (was multi: %s)', async wasMultiSelect => {
    vi.useFakeTimers();
    const oldTemplate: GameTemplate = { ...template, columns: [{ ...column, inputType: 'clicker', isMultiSelect: wasMultiSelect,
      quickActions: [{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: 5 }] }] };
    const reply = vi.fn((_connection: unknown, _message: unknown) => true);
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host', template: oldTemplate, session,
      store: createRuntimeStore(), deliveryStore: createDeliveryStore(),
      transport: { sendToHost: () => false, sendToConnection: reply, broadcastLocalChanges: async () => undefined },
    });
    const playerStore = createRuntimeStore();
    const delivery = createDeliveryStore();
    const bindingStore = createBindingStore();
    const playerOptions = { store: playerStore, deliveryStore: delivery, bindingStore, deviceId: 'guest',
      transport: { sendToHost: vi.fn(() => false), sendToConnection: () => false, broadcastLocalChanges: async () => undefined } };
    const participant = await createMultiplayerPlayerRoomRuntime({ ...playerOptions, bootstrapMessage: host.session.createBootstrapMessage() });
    const scoreValue: ScoreValue = wasMultiSelect ? { parts: [3, 5], multiOptionIds: ['a', 'b'] } : { parts: [3], optionId: 'a' };
    const patch = await participant.controller.queueScoreValuePatch({
      actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue,
    });
    expect(participant.session.session.players[0].totalScore).toBe(wasMultiSelect ? 8 : 3);
    const original = JSON.stringify(patch);
    const nextTemplate = { ...oldTemplate, updatedAt: 2, columns: [{ ...oldTemplate.columns[0], isMultiSelect: !wasMultiSelect,
      quickActions: [{ id: 'a', label: 'A', value: 10 }, { id: 'b', label: 'B', value: 20 }] }] };
    await host.controller.applyLocalBoard(nextTemplate, host.session.session);
    const bootstrap = host.session.createBootstrapMessage();
    await participant.receive(bootstrap);
    expect(getEffectiveIds(participant.session.template.columns[0], participant.session.session.players[0].scores.points)).toEqual(['a']);
    expect(participant.session.session.players[0].totalScore).toBe(10);
    expect((await delivery.listOutbox('room-1', session.id)).map(item => item.message)).toEqual([patch]);

    // Restart with the same durable outbox: recovery must use the new schema,
    // while replay still sends the original operation ID, sequence and payload.
    participant.stop();
    const restored = await createMultiplayerPlayerRoomRuntime({ ...playerOptions, bootstrapMessage: bootstrap });
    expect(getEffectiveIds(restored.session.template.columns[0], restored.session.session.players[0].scores.points)).toEqual(['a']);
    expect(restored.session.session.players[0].totalScore).toBe(10);
    playerOptions.transport.sendToHost.mockClear();
    await restored.controller.replayPendingPatches();
    expect(playerOptions.transport.sendToHost).toHaveBeenCalledExactlyOnceWith(patch);

    const connection = {};
    await host.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: session.id, deviceId: 'guest', playerId: 'p1' }, connection);
    expect(await host.receive(patch, connection)).toBe(true);
    expect(getEffectiveIds(host.session.template.columns[0], host.session.session.players[0].scores.points)).toEqual(['a']);
    expect(host.session.session.players[0].totalScore).toBe(10);
    const ack = reply.mock.calls[reply.mock.calls.length - 1]?.[1];
    expect(ack).toMatchObject({ type: 'score:patch-result', accepted: true, opId: patch.opId });
    await restored.receive(ack);
    expect(restored.session.session.players[0].totalScore).toBe(10);
    expect(await delivery.listOutbox('room-1', session.id)).toHaveLength(0);
    expect(JSON.stringify(patch)).toBe(original);
    host.stop();
    restored.stop();
  });

  it('applies a delayed template without rolling back newer confirmed or pending inputs', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createRuntimeStore();
    const delivery = createDeliveryStore();
    const sendToHost = vi.fn(() => false);
    const runtime = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'device',
      store, deliveryStore: delivery, bindingStore: createBindingStore(),
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
    });
    host.applyLocalBoard({ ...template, columns: [{ ...column, formula: 'a1×c1', constants: { c1: 2 } }], updatedAt: 2 }, host.session);
    const delayedTemplate = host.createBootstrapMessage();
    const newerScore = host.applyLocalSession({ ...host.session, players: [{ ...session.players[0], scores: { points: { parts: [4] } } }] })!;
    await runtime.receive(newerScore);
    const pending = await runtime.controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    sendToHost.mockClear();
    const persistBootstrap = store.persistBootstrap;
    const persisted = vi.spyOn(store, 'persistBootstrap');
    let finishWrite!: () => void;
    const writing = new Promise<void>(resolve => { finishWrite = resolve; });
    persisted.mockImplementationOnce(async (records) => { await writing; await persistBootstrap(records); });
    // Same timestamp but stale local content must not hide the live host structure.
    await store.putTemplate({ ...template, updatedAt: 2 });
    const apply = runtime.receive(delayedTemplate);
    await vi.waitFor(() => expect(persisted).toHaveBeenCalledTimes(1));
    const latestScore = host.applyLocalSession({ ...host.session, players: [{ ...session.players[0], scores: { points: { parts: [5] } } }] })!;
    const newer = runtime.receive(latestScore);
    finishWrite();
    await Promise.all([apply, newer]);

    expect(runtime.session.revision).toBe(latestScore.revision);
    expect(runtime.session.session.players[0]).toMatchObject({ scores: { points: { parts: [7] } }, totalScore: 14 });
    expect(await store.getSession('session-1')).toMatchObject({ players: [{ scores: { points: { parts: [5] } }, totalScore: 10 }] });
    expect(await store.getRoom('room-1')).toMatchObject({ revision: latestScore.revision });
    expect(await store.getTemplate('template-1')).toMatchObject({ columns: [{ formula: 'a1×c1', constants: { c1: 2 } }] });
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(1);
    expect(sendToHost).not.toHaveBeenCalled();

    const obsoleteTemplate = { ...delayedTemplate, package: { ...delayedTemplate.package, revision: 1, template } };
    expect(await runtime.receive(obsoleteTemplate)).toBe(false);
    expect(persisted).toHaveBeenCalledTimes(1);
    await runtime.receive({ type: 'score:patch-result', roomId: 'room-1', sessionId: 'session-1', opId: pending.opId, accepted: false, reason: 'test_rejected' });
    expect(runtime.session.session.players[0].totalScore).toBe(10);
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(0);
    runtime.stop();
  });
  it('persists a complete permission set and removes it when all permissions are cleared', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const connection = {};
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false,
      sendToConnection: (_connection, message) => { void player.receive(message); return true; },
      broadcastLocalChanges: vi.fn(async () => undefined),
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { void host.receive(message, connection); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 20 });

    expect(player.controller.setPlayerClaims(['p1'])).toBe(true);
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toMatchObject({ playerIds: ['p1'] }));
    expect(host.getParticipantClaims()).toEqual({ p1: 1 });

    expect(player.controller.setPlayerClaims([])).toBe(true);
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toBeUndefined());
    expect(host.getParticipantClaims()).toEqual({});
  });

  it('reclaims the bound player and replays legacy undefined input fields through PeerJS', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const connection = {};
    let connected = true;
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false,
      sendToConnection: (_connection, message) => { void player.receive(throughPeerJs(message)); return true; },
      broadcastLocalChanges: vi.fn(async () => undefined),
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { if (!connected) return false; void host.receive(throughPeerJs(message), connection); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    const bootstrap = host.session.createBootstrapMessage();
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 20 });

    player.controller.claimPlayer('p1');
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toMatchObject({ playerId: 'p1' }));

    connected = false;
    await player.controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [8] } });
    const [legacy] = await playerDelivery.listOutbox('room-1', 'session-1');
    const message = legacy.message;
    if (!isScoreValuePatchMessage(message)) throw new Error('Unexpected pending operation');
    await playerDelivery.putOutbox({ ...legacy, message: { ...message,
      patch: { ...message.patch, scoreValue: { parts: [8], optionId: undefined, multiOptionIds: undefined } },
    } });
    expect((await playerDelivery.listOutbox('room-1', 'session-1'))).toHaveLength(1);
    expect(host.session.session.players[0].scores.points).toBeUndefined();
    expect(player.session.session.players[0].totalScore).toBe(8);

    connected = true;
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 30 });
    expect(player.session.session.players[0].totalScore).toBe(8);
    // The optimistic value is recovered from the durable outbox, not saved as confirmed data.
    expect((await playerStore.getSession('session-1'))?.players[0].totalScore).toBe(0);
    expect(await player.restoreParticipantBinding()).toBe(true);

    await vi.waitFor(async () => expect(await playerDelivery.listOutbox('room-1', 'session-1')).toHaveLength(0));
    expect(host.session.session.players[0].scores.points).toEqual({ parts: [8] });
    expect(host.session.revision).toBe(2);
  });

  it('restores a forked host template with accepted sequences despite legacy stale room metadata', async () => {
    const store = createRuntimeStore(); const delivery = createDeliveryStore();
    const reply = vi.fn(); const broadcast = vi.fn(() => true); const connection = {};
    const transport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; },
      broadcastLocalChanges: async () => undefined, broadcastMessage: broadcast,
    };
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, revision: 7, store, deliveryStore: delivery, transport, now: () => 10 });
    const claim = { type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', playerId: 'p1' };
    const score = {
      type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', opId: 'score-new', sequence: 2, updatedAt: 12,
      patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [12] } },
    };
    const total = {
      type: 'player:total-adjustment', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', opId: 'total-new', sequence: 2, updatedAt: 13,
      actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', targetTotal: 16,
    };
    await host.receive(claim, connection);
    await host.receive(score, connection);
    await host.receive(total, connection);
    const forkedTemplate = { ...template, id: 'forked-template', sourceTemplateId: template.id };
    await store.putTemplate(forkedTemplate);
    await store.putSession({ ...host.session.session, templateId: forkedTemplate.id });
    // Older releases saved the new session identity but left room.templateId behind.
    const restored = await restoreMultiplayerHostRoomRuntime({ roomId: 'room-1', store, deliveryStore: delivery, transport, now: () => 20 });
    expect(restored?.session.template.id).toBe(forkedTemplate.id);
    expect((await store.getRoom('room-1'))?.templateId).toBe(forkedTemplate.id);
    expect(restored?.session.room).toEqual({ roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 });
    expect(restored?.session.revision).toBe(9);
    const readSequence = vi.spyOn(delivery, 'getSequence');
    await restored!.receive(claim, connection);
    await restored!.receive({ ...score, opId: 'score-old', sequence: 1, patch: { ...score.patch, scoreValue: { parts: [7] } } }, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'outdated_player_update' }));
    await restored!.receive({ ...total, opId: 'total-old', sequence: 1, targetTotal: 8 }, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'outdated_player_update' }));
    await restored!.receive(score, connection);
    await restored!.receive(total, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, snapshot: expect.objectContaining({ revision: 9 }) }));
    expect(restored!.session.session.players[0]).toMatchObject({ totalScore: 16, bonusScore: 4, scores: { points: { parts: [12] } } });
    expect(broadcast).toHaveBeenCalledTimes(2);
    await restored!.receive({ ...score, opId: 'score-later', sequence: 3, patch: { ...score.patch, scoreValue: { parts: [13] } } }, connection);
    expect(restored!.session.session.players[0].totalScore).toBe(17);
    expect(readSequence).toHaveBeenCalledTimes(2);
    readSequence.mockRestore();
  });

  it('restores a player binding with its forked session template despite legacy stale room metadata', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const transport: MultiplayerRoomRuntimeTransport = { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined };

    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport, now: () => 10 });
    const bootstrap = host.session.createBootstrapMessage();
    const player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport, now: () => 20 });
    await saveParticipantBinding({ store: bindingStore, roomId: 'room-1', sessionId: 'session-1', deviceId: 'player-device', playerIds: ['p1'] });
    const forkedTemplate = { ...template, id: 'forked-template', sourceTemplateId: template.id };
    await playerStore.putTemplate(forkedTemplate);
    await playerStore.putSession({ ...player.session.session, templateId: forkedTemplate.id });

    const restored = await restoreMultiplayerPlayerRoomRuntime({
      roomId: 'room-1',
      deviceId: 'player-device',
      store: playerStore,
      bindingStore,
      deliveryStore: playerDelivery,
      transport,
      now: () => 30,
    });
    expect(restored).not.toBeNull();
    expect(restored?.session.template.id).toBe(forkedTemplate.id);
    expect((await playerStore.getRoom('room-1'))?.templateId).toBe(forkedTemplate.id);
    expect(restored?.session.room).toEqual({ roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 });
    expect(await restored?.restoreParticipantBinding()).toBe(true);
  });

  it('returns session ownership only after the host completes the room', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    let stopped = false; let released: GameSession | undefined;
    const connection = {};
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false, sendToConnection: (_connection, message) => { void player.receive(message); return true; }, broadcastLocalChanges: async () => undefined,
      broadcastMessage: (message) => { void player.receive(message); return true; },
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { void host.receive(message, connection); return true; }, sendToConnection: () => false, broadcastLocalChanges: async () => undefined,
      stop: () => { stopped = true; },
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device', store: playerStore,
      bindingStore, deliveryStore: playerDelivery, transport: playerTransport,
      onOwnershipReturned: (localSession) => { released = localSession; }, now: () => 20,
    });
    player.controller.claimPlayer('p1');
    await vi.waitFor(() => expect(host.getParticipantClaims()).toEqual({ p1: 1 }));
    await host.controller.complete();
    await vi.waitFor(() => expect(released?.status).toBe('active'));
    expect(stopped).toBe(true);
    expect(released?.players).toEqual(session.players);
  });

  it('stops the participant transport as soon as completion arrives, before local persistence finishes', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const host = await createMultiplayerHostRoomRuntime({
      roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore,
      deliveryStore: hostDelivery,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      now: () => 10,
    });
    let finishPersistence!: () => void;
    const persistenceGate = new Promise<void>((resolve) => { finishPersistence = resolve; });
    const originalRelease = playerStore.releaseRoomOwnership;
    const stop = vi.fn();
    const player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device',
      store: playerStore, bindingStore, deliveryStore: playerDelivery,
      transport: { sendToHost: () => true, sendToConnection: () => false, broadcastLocalChanges: async () => undefined, stop },
      now: () => 20,
    });
    playerStore.releaseRoomOwnership = async (records) => {
      await persistenceGate;
      return originalRelease(records);
    };

    const completion = host.session.complete();
    completion.finalSession.players[0] = { ...session.players[0], scores: { points: { parts: [9] } }, bonusScore: 2, totalScore: 999 };
    completion.finalSession.winnerIds = ['incorrect'];
    const receiving = player.receive(completion);
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    finishPersistence();
    await receiving;
    expect((await playerStore.getSession('session-1'))?.players[0].totalScore).toBe(11);
    expect((await playerStore.getSession('session-1'))?.winnerIds).toEqual(['p1']);
    expect(await player.receive(completion)).toBe(false);
  });

  it('ignores a late completion after the participant has left the room', async () => {
    const store = createRuntimeStore();
    const delivery = createDeliveryStore();
    const bindingStore = createBindingStore();
    const sent: unknown[] = [];
    let released = false;
    const transport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { sent.push(message); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
      stop: vi.fn(),
    };
    const player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: {
        type: 'room:bootstrap',
        roomId: 'room-1',
        package: {
          version: 1,
          room: { roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 },
          template,
          session,
          revision: 1,
          exportedAt: 10,
        },
      },
      deviceId: 'player-device',
      store,
      bindingStore,
      deliveryStore: delivery,
      transport,
      onOwnershipReturned: () => { released = true; },
      now: () => 20,
    });

    expect(player.leaveRoom()).toBe(true);
    expect(sent).toEqual([expect.objectContaining({ type: 'room:leave' })]);

    const completed = await player.receive({
      type: 'session:completed',
      roomId: 'room-1',
      sessionId: 'session-1',
      template,
      finalSession: { ...session, status: 'completed' },
      revision: 2,
      completedAt: 30,
    });

    expect(completed).toBe(false);
    expect(released).toBe(false);
    expect(transport.stop).toHaveBeenCalledTimes(1);
  });

  it('cancels an ownership handoff already reading data when the participant explicitly leaves', async () => {
    const store = createRuntimeStore();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const onOwnershipReturned = vi.fn();
    const participant = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: host.createBootstrapMessage(), deviceId: 'guest', store,
      deliveryStore: createDeliveryStore(), bindingStore: createBindingStore(), onOwnershipReturned,
      transport: { sendToHost: () => true, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
    });
    let startRead!: () => void;
    let finishRead!: () => void;
    const started = new Promise<void>(resolve => { startRead = resolve; });
    const gate = new Promise<void>(resolve => { finishRead = resolve; });
    const readTemplate = store.getTemplate;
    vi.spyOn(store, 'getTemplate').mockImplementationOnce(async id => { startRead(); await gate; return readTemplate(id); });
    const releaseOwnership = vi.spyOn(store, 'releaseRoomOwnership');
    const receiving = participant.receive(host.complete());
    await started;
    participant.leaveRoom();
    finishRead();
    await receiving;
    await participant.whenIdle?.();
    expect(releaseOwnership).not.toHaveBeenCalled();
    expect(onOwnershipReturned).not.toHaveBeenCalled();
    expect(await store.getSession(session.id)).toMatchObject({ status: 'active', players: session.players });
  });
});

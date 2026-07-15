import { describe, expect, it, vi } from 'vitest';
import { participantBindingKey, saveParticipantBinding } from './multiplayerParticipantBinding';

describe('multiplayer participant binding', () => {
  it('persists one claimed player per room and device', async () => {
    const put = vi.fn(async () => undefined);
    const record = await saveParticipantBinding({
      store: { get: async () => undefined, put }, roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'player-1', now: () => 10,
    });
    expect(participantBindingKey('room-1', 'device-1')).toBe('room-1:device-1');
    expect(record).toEqual({ id: 'room-1:device-1', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'player-1', updatedAt: 10 });
    expect(put).toHaveBeenCalledWith(record);
  });
});

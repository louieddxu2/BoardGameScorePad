import { describe, expect, it } from 'vitest';
import { ScoreColumn } from '../../types';
import { createPlayerSessionCapabilities, hostSessionCapabilities } from './sessionCapabilities';

const personal: ScoreColumn = { id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none' };
const shared: ScoreColumn = { ...personal, id: 'shared', isShared: true };

describe('multiplayer session capabilities', () => {
  it('keeps host session controls unchanged', () => {
    expect(hostSessionCapabilities.canEditScore('any-player', personal)).toBe(true);
    expect(hostSessionCapabilities.canEditTemplate).toBe(true);
    expect(hostSessionCapabilities.canManageSession).toBe(true);
  });

  it('limits a player to their own non-shared score cells', () => {
    const capabilities = createPlayerSessionCapabilities('p2');
    expect(capabilities.canEditScore('p2', personal)).toBe(true);
    expect(capabilities.canEditScore('p1', personal)).toBe(false);
    expect(capabilities.canEditScore('p2', shared)).toBe(false);
    expect(capabilities.canEditScore('p2', undefined)).toBe(false);
    expect(capabilities.canEditPlayers).toBe(false);
    expect(capabilities.canManageSession).toBe(false);
  });
});

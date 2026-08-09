import { describe, expect, it } from 'vitest';
import { Player } from '../../../types';
import { resolveManualIdentityFlag } from './playerIdentity';

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 'player_1',
  name: 'Predicted Alice',
  linkedPlayerId: 'saved-a',
  color: '#fff',
  scores: {},
  totalScore: 0,
  ...overrides
});

describe('resolveManualIdentityFlag', () => {
  it('marks changed or explicitly selected identities as manual', () => {
    expect(resolveManualIdentityFlag(player(), 'Alice', 'saved-a', false)).toBe(true);
    expect(resolveManualIdentityFlag(player(), 'Predicted Alice', 'saved-a', true)).toBe(true);
  });

  it('does not mark an untouched prediction and clears the flag for an empty slot', () => {
    expect(resolveManualIdentityFlag(player(), 'Predicted Alice', 'saved-a', false)).toBe(false);
    expect(resolveManualIdentityFlag(player({ isIdentityManuallySet: true }), '', undefined, false)).toBe(false);
  });
});

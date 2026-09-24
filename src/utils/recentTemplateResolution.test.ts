import { describe, expect, it } from 'vitest';
import type { GameTemplate } from '../types';
import { resolveRecentGameTemplate } from './recentTemplateResolution';

const template = (id: string, name: string, bggId?: string): GameTemplate => ({
  id,
  name,
  bggId,
  columns: [],
  createdAt: 1
});

describe('resolveRecentGameTemplate', () => {
  it('uses BGG ID to select the matching board among same-name templates', () => {
    const matching = template('matching', 'Sky Totems', '123');

    expect(resolveRecentGameTemplate([
      template('different-game', 'Sky Totems', '456'),
      matching
    ], { gameName: 'Sky Totems', bggId: '123' })).toBe(matching);
  });

  it('falls back to a unique same-name template when the template has no BGG ID', () => {
    const matching = template('existing-board', 'Sky Totems');

    expect(resolveRecentGameTemplate([matching], {
      gameName: ' sky   totems ',
      bggId: '123'
    })).toBe(matching);
  });

  it('uses a unique name match when the history item has no BGG ID', () => {
    const matching = template('existing-board', 'Simple Game', '123');

    expect(resolveRecentGameTemplate([matching], { gameName: 'simple game' })).toBe(matching);
  });

  it('does not guess when the only name match has a conflicting BGG ID', () => {
    expect(resolveRecentGameTemplate(
      [template('different-game', 'Sky Totems', '456')],
      { gameName: 'Sky Totems', bggId: '123' }
    )).toBeNull();
  });

  it('does not guess between ambiguous same-name templates', () => {
    expect(resolveRecentGameTemplate([
      template('one', 'Same Name'),
      template('two', 'Same Name')
    ], { gameName: 'Same Name' })).toBeNull();
  });
});

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { findLocalRuleSummary } from '../../official-boards/gameCatalog';
import { getGameRules } from '../rulesCache';
import type { GameRules, RuleSummary } from '../types';

/**
 * A game's rule count and version, from the local game catalog only: opening a game never
 * reaches the network. A game the catalog does not know yet shows no count until the catalog
 * is updated. null when disabled, unknown or without rules.
 */
export const useRuleSummary = (bggId: string | undefined, enabled: boolean): RuleSummary | null => {
  const id = enabled ? bggId?.trim() : undefined;
  const local = useLiveQuery(async () => (id ? (await findLocalRuleSummary(id)) ?? null : null), [id]);
  return local ?? null;
};

export type GameRulesState =
  | { status: 'idle' | 'loading' | 'failed' }
  | { status: 'ready'; rules: GameRules | null; stale: boolean };

/** The rules themselves, read only once `open` is true (reused from cache by version, up to 7 days). */
export const useGameRules = (summary: RuleSummary | null, open: boolean): GameRulesState => {
  const [state, setState] = useState<GameRulesState>({ status: 'idle' });
  const gameId = summary?.ruleGameId;
  const version = summary?.ruleVersion;
  useEffect(() => {
    if (!open || !summary) return;
    let cancelled = false;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    getGameRules(summary)
      .then((result) => { if (!cancelled) setState({ status: 'ready', rules: result.value, stale: result.stale }); })
      .catch(() => { if (!cancelled) setState({ status: 'failed' }); });
    return () => { cancelled = true; };
    // The summary object is recreated on each read; its game and version decide what to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameId, version]);
  return state;
};

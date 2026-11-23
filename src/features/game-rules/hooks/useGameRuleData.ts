import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { findLocalRuleSummary } from '../../official-boards/gameCatalog';
import { getGameRules, getRuleSummary } from '../rulesCache';
import type { GameRules, RuleSummary } from '../types';

/**
 * A game's rule count and version. Read from the local game catalog, so opening a game needs
 * no network; only a BGG ID the catalog does not know yet asks the cloud (cached for an hour
 * in rulesCache, "no rules" included). null until known, when disabled, or without rules.
 */
export const useRuleSummary = (bggId: string | undefined, enabled: boolean): RuleSummary | null => {
  const id = enabled ? bggId?.trim() : undefined;
  // undefined while reading; then the catalog's answer, or 'unknown' when it does not have this game.
  const local = useLiveQuery(async () => (id ? (await findLocalRuleSummary(id)) ?? 'unknown' : null), [id]);
  const [fallback, setFallback] = useState<RuleSummary | null>(null);
  useEffect(() => {
    setFallback(null);
    if (!id || local !== 'unknown') return;
    let cancelled = false;
    getRuleSummary(id)
      .then((result) => { if (!cancelled) setFallback(result.value); })
      .catch(() => { /* No summary means no entry; the score pad works the same without it. */ });
    return () => { cancelled = true; };
  }, [id, local]);
  if (!id || local === undefined || local === null) return null;
  return local === 'unknown' ? fallback : local;
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

import { useEffect, useState } from 'react';
import { getGameRules, getRuleSummary } from '../rulesCache';
import type { GameRules, RuleSummary } from '../types';

/**
 * A game's rule count and version, read when the game opens (cached for an hour in rulesCache).
 * null until known, when disabled, when the game has no rules, or when it cannot be read.
 */
export const useRuleSummary = (bggId: string | undefined, enabled: boolean): RuleSummary | null => {
  const [summary, setSummary] = useState<RuleSummary | null>(null);
  useEffect(() => {
    setSummary(null);
    if (!enabled || !bggId) return;
    let cancelled = false;
    getRuleSummary(bggId)
      .then((result) => { if (!cancelled) setSummary(result.value); })
      .catch(() => { /* No summary means no entry; the score pad works the same without it. */ });
    return () => { cancelled = true; };
  }, [bggId, enabled]);
  return summary;
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

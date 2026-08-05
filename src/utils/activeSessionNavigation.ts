import type { Dispatch, SetStateAction } from 'react';
import { AppView } from '../types';

/**
 * These are the only events allowed to enter the active score-sheet view.
 * Background synchronization deliberately has no source in this union.
 */
export type ActiveSessionEntrySource =
  | 'qr-join'
  | 'resume-active-session'
  | 'start-new-session';

export type EnterActiveSession = (source: ActiveSessionEntrySource) => boolean;

const ACTIVE_SESSION_ENTRY_SOURCES: ReadonlySet<string> = new Set([
  'qr-join',
  'resume-active-session',
  'start-new-session',
]);

export const isExplicitActiveSessionEntry = (source: string): source is ActiveSessionEntrySource =>
  ACTIVE_SESSION_ENTRY_SOURCES.has(source);

/**
 * Central navigation gate for ACTIVE_SESSION.
 *
 * Do not derive this transition from currentSession, a room reconnect, or a
 * remote bootstrap. Those operations may restore data in the background, but
 * only an explicit source may change the visible view.
 */
export const navigateToActiveSession = (
  setView: Dispatch<SetStateAction<AppView>>,
  source: ActiveSessionEntrySource,
): boolean => {
  if (!isExplicitActiveSessionEntry(source)) return false;
  setView(AppView.ACTIVE_SESSION);
  return true;
};

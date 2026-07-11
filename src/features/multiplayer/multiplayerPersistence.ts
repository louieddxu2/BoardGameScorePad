import { GameSession, GameTemplate, HistoryRecord } from '../../types';
import { createHistoryRecordFromFinalSnapshot } from './multiplayerHistory';
import { BootstrapPackageMessage, isBootstrapPackageMessage } from './protocol';
import { resolveBootstrapImport, TemplateImportDecision } from './sessionBootstrap';

export interface MultiplayerBootstrapStore {
  getTemplate(id: string): Promise<GameTemplate | undefined>;
  putTemplate(template: GameTemplate): Promise<unknown>;
  putSession(session: GameSession): Promise<unknown>;
}

export interface MultiplayerHistoryStore {
  putHistory(record: HistoryRecord): Promise<unknown>;
  deleteSession(sessionId: string): Promise<unknown>;
}

export interface PersistedBootstrapImport {
  decision: TemplateImportDecision;
  session: GameSession;
  templateForSession: GameTemplate;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Keeps one local template per ID, using a deterministic copy only when local is newer. */
export const persistMultiplayerBootstrap = async (
  message: BootstrapPackageMessage,
  store: MultiplayerBootstrapStore
): Promise<PersistedBootstrapImport> => {
  if (!isBootstrapPackageMessage(message)) {
    throw new Error('invalid_bootstrap_message');
  }

  const localTemplate = await store.getTemplate(message.package.template.id);
  const resolved = resolveBootstrapImport(message.package, localTemplate);

  if (
    resolved.decision.action === 'add-new' ||
    resolved.decision.action === 'overwrite-local' ||
    resolved.decision.action === 'add-session-copy'
  ) {
    await store.putTemplate(cloneJson(resolved.templateForSession));
  }

  await store.putSession(cloneJson(resolved.session));

  return {
    decision: resolved.decision,
    session: resolved.session,
    templateForSession: resolved.templateForSession,
  };
};

/** Saves a final snapshot for every participant and clears its active-session copy. */
export const persistMultiplayerCompletion = async (options: {
  store: MultiplayerHistoryStore;
  template: GameTemplate;
  session: GameSession;
  completedAt: number;
  location?: string;
}): Promise<HistoryRecord> => {
  const record = createHistoryRecordFromFinalSnapshot({
    template: options.template,
    session: options.session,
    completedAt: options.completedAt,
    location: options.location,
  });

  await options.store.putHistory(record);
  await options.store.deleteSession(options.session.id);
  return record;
};

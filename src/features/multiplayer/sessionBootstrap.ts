import { GameSession, GameTemplate } from '../../types';
import {
  MULTIPLAYER_PROTOCOL_VERSION,
  MultiplayerRoomInfo,
  SessionBootstrapPackage,
  isSessionBootstrapPackage,
} from './protocol';

export type TemplateImportDecision =
  | { action: 'reuse-local'; templateId: string }
  | { action: 'overwrite-local'; templateId: string }
  | { action: 'add-new'; templateId: string }
  | { action: 'add-session-copy'; templateId: string; sourceTemplateId: string; reason: 'local-newer' };

export interface ResolvedBootstrapImport {
  decision: TemplateImportDecision;
  templateForSession: GameTemplate;
  session: GameSession;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const getMultiplayerSessionTemplateId = (sessionId: string): string => `Multiplayer-${sessionId}`;

export const getTemplateVersion = (template: Pick<GameTemplate, 'createdAt' | 'updatedAt'>): number => {
  return template.updatedAt ?? template.createdAt;
};

export const createSessionBootstrapPackage = (options: {
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  now?: () => number;
}): SessionBootstrapPackage => {
  const now = options.now ?? Date.now;
  return {
    version: MULTIPLAYER_PROTOCOL_VERSION,
    room: cloneJson(options.room),
    template: cloneJson(options.template),
    session: cloneJson(options.session),
    revision: options.revision,
    exportedAt: now(),
  };
};

export const decideTemplateImport = (
  remoteTemplate: GameTemplate,
  localTemplate?: GameTemplate | null,
  sessionTemplateId: string = remoteTemplate.id
): TemplateImportDecision => {
  if (!localTemplate || localTemplate.id !== remoteTemplate.id) {
    return { action: 'add-new', templateId: remoteTemplate.id };
  }

  const localVersion = getTemplateVersion(localTemplate);
  const remoteVersion = getTemplateVersion(remoteTemplate);

  if (localVersion === remoteVersion) {
    return { action: 'reuse-local', templateId: remoteTemplate.id };
  }

  if (remoteVersion > localVersion) {
    return { action: 'overwrite-local', templateId: remoteTemplate.id };
  }

  return {
    action: 'add-session-copy',
    templateId: sessionTemplateId,
    sourceTemplateId: remoteTemplate.id,
    reason: 'local-newer',
  };
};

export const resolveBootstrapImport = (
  bootstrap: SessionBootstrapPackage,
  localTemplate?: GameTemplate | null
): ResolvedBootstrapImport => {
  if (!isSessionBootstrapPackage(bootstrap)) {
    throw new Error('invalid_bootstrap_package');
  }

  const decision = decideTemplateImport(
    bootstrap.template,
    localTemplate,
    getMultiplayerSessionTemplateId(bootstrap.session.id)
  );
  const templateForSession = decision.action === 'reuse-local' && localTemplate
    ? cloneJson(localTemplate)
    : cloneJson(bootstrap.template);
  if (decision.action === 'add-session-copy') {
    templateForSession.id = decision.templateId;
  }

  return {
    decision,
    templateForSession,
    session: {
      ...cloneJson(bootstrap.session),
      templateId: templateForSession.id,
      name: bootstrap.session.name || templateForSession.name,
      bggId: bootstrap.session.bggId ?? templateForSession.bggId,
      status: 'active',
    },
  };
};

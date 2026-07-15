import { GameSession, GameTemplate } from '../../types';
import { ScorePatchActor, ScoreValuePatch, isValidScoreValue } from './scoreValuePatch';

export const MULTIPLAYER_PROTOCOL_VERSION = 1 as const;

export type MultiplayerRole = 'host' | 'player';

export interface MultiplayerRoomInfo {
  roomId: string;
  hostDeviceId: string;
  createdAt: number;
}

export interface SessionBootstrapPackage {
  version: typeof MULTIPLAYER_PROTOCOL_VERSION;
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  exportedAt: number;
}

export interface BootstrapRequestMessage {
  type: 'room:bootstrap-request';
  roomId: string;
  requesterDeviceId: string;
  joinToken?: string;
  requestedAt: number;
}

export interface BootstrapPackageMessage {
  type: 'room:bootstrap';
  roomId: string;
  package: SessionBootstrapPackage;
}

export interface ScoreValuePatchMessage {
  type: 'score:valuePatch';
  roomId: string;
  sessionId: string;
  opId: string;
  deviceId: string;
  sequence: number;
  patch: ScoreValuePatch;
  updatedAt: number;
}

export interface TotalAdjustmentPatchMessage {
  type: 'player:total-adjustment';
  roomId: string;
  sessionId: string;
  opId: string;
  deviceId: string;
  sequence: number;
  actor: ScorePatchActor;
  targetPlayerId: string;
  targetTotal: number;
  updatedAt: number;
}

export interface ParticipantClaimMessage {
  type: 'room:claim-player';
  roomId: string;
  sessionId: string;
  deviceId: string;
  playerId: string;
}

export interface ParticipantClaimResultMessage {
  type: 'room:claim-result';
  roomId: string;
  sessionId: string;
  accepted: boolean;
  playerId?: string;
  reason?: string;
}

export interface SessionSnapshotMessage {
  type: 'session:snapshot';
  roomId: string;
  sessionId: string;
  session: GameSession;
  revision: number;
  updatedAt: number;
}

export interface ScorePatchResultMessage {
  type: 'score:patch-result';
  roomId: string;
  sessionId: string;
  opId: string;
  accepted: boolean;
  snapshot?: SessionSnapshotMessage;
  reason?: string;
}

export interface SessionCompletedMessage {
  type: 'session:completed';
  roomId: string;
  sessionId: string;
  template: GameTemplate;
  finalSession: GameSession;
  revision: number;
  completedAt: number;
}

export type MultiplayerMessage =
  | BootstrapRequestMessage
  | BootstrapPackageMessage
  | ScoreValuePatchMessage
  | TotalAdjustmentPatchMessage
  | ParticipantClaimMessage
  | ParticipantClaimResultMessage
  | ScorePatchResultMessage
  | SessionSnapshotMessage
  | SessionCompletedMessage;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const hasString = (value: Record<string, unknown>, key: string): boolean => {
  return typeof value[key] === 'string' && value[key] !== '';
};

const hasNumber = (value: Record<string, unknown>, key: string): boolean => {
  return typeof value[key] === 'number' && Number.isFinite(value[key]);
};

export const isGameTemplateLike = (value: unknown): value is GameTemplate => {
  if (!isRecord(value)) return false;
  return hasString(value, 'id') &&
    hasString(value, 'name') &&
    Array.isArray(value.columns) &&
    hasNumber(value, 'createdAt');
};

export const isGameSessionLike = (value: unknown): value is GameSession => {
  if (!isRecord(value)) return false;
  return hasString(value, 'id') &&
    hasString(value, 'templateId') &&
    hasNumber(value, 'startTime') &&
    Array.isArray(value.players) &&
    (value.status === 'active' || value.status === 'completed');
};

export const isSessionBootstrapPackage = (value: unknown): value is SessionBootstrapPackage => {
  if (!isRecord(value)) return false;
  if (value.version !== MULTIPLAYER_PROTOCOL_VERSION) return false;

  const room = value.room;
  if (!isRecord(room) || !hasString(room, 'roomId') || !hasString(room, 'hostDeviceId') || !hasNumber(room, 'createdAt')) {
    return false;
  }

  return isGameTemplateLike(value.template) &&
    isGameSessionLike(value.session) &&
    hasNumber(value, 'revision') &&
    hasNumber(value, 'exportedAt');
};

export const isBootstrapPackageMessage = (value: unknown): value is BootstrapPackageMessage => {
  if (!isRecord(value) || value.type !== 'room:bootstrap' || !hasString(value, 'roomId')) return false;
  if (!isSessionBootstrapPackage(value.package)) return false;
  return value.roomId === value.package.room.roomId;
};

export const isScoreValuePatchMessage = (value: unknown): value is ScoreValuePatchMessage => {
  if (!isRecord(value)) return false;
  if (value.type !== 'score:valuePatch') return false;
  if (!hasString(value, 'roomId') || !hasString(value, 'sessionId') || !hasString(value, 'opId') || !hasString(value, 'deviceId')) {
    return false;
  }
  const sequence = value.sequence;
  if (!hasNumber(value, 'updatedAt') || typeof sequence !== 'number' || sequence < 1 || !Number.isInteger(sequence)) return false;

  const patch = value.patch;
  if (!isRecord(patch)) return false;
  if (!hasString(patch, 'targetPlayerId') || !hasString(patch, 'colId')) return false;
  if (patch.scoreValue !== null && !isValidScoreValue(patch.scoreValue)) return false;

  const actor = patch.actor;
  if (!isRecord(actor)) return false;
  if (actor.role === 'host') return true;
  return actor.role === 'player' && hasString(actor, 'playerId');
};

export const isTotalAdjustmentPatchMessage = (value: unknown): value is TotalAdjustmentPatchMessage => {
  if (!isRecord(value) || value.type !== 'player:total-adjustment') return false;
  if (!hasString(value, 'roomId') || !hasString(value, 'sessionId') || !hasString(value, 'opId') || !hasString(value, 'deviceId') || !hasString(value, 'targetPlayerId')) return false;
  const sequence = value.sequence;
  if (!hasNumber(value, 'updatedAt') || !hasNumber(value, 'targetTotal') || typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1) return false;
  const actor = value.actor;
  if (!isRecord(actor)) return false;
  return actor.role === 'host' || (actor.role === 'player' && hasString(actor, 'playerId'));
};

export const isParticipantClaimMessage = (value: unknown): value is ParticipantClaimMessage => {
  return isRecord(value) && value.type === 'room:claim-player' && hasString(value, 'roomId') && hasString(value, 'sessionId') && hasString(value, 'deviceId') && hasString(value, 'playerId');
};

export const isParticipantClaimResultMessage = (value: unknown): value is ParticipantClaimResultMessage => {
  if (!isRecord(value) || value.type !== 'room:claim-result' || !hasString(value, 'roomId') || !hasString(value, 'sessionId') || typeof value.accepted !== 'boolean') return false;
  return value.accepted ? hasString(value, 'playerId') : typeof value.reason === 'string' && value.reason !== '';
};

export const isSessionSnapshotMessage = (value: unknown): value is SessionSnapshotMessage => {
  if (!isRecord(value) || value.type !== 'session:snapshot') return false;
  const revision = value.revision;
  return hasString(value, 'roomId') &&
    hasString(value, 'sessionId') &&
    isGameSessionLike(value.session) &&
    value.session.id === value.sessionId &&
    typeof revision === 'number' && Number.isFinite(revision) && revision >= 0 &&
    hasNumber(value, 'updatedAt');
};

export const isScorePatchResultMessage = (value: unknown): value is ScorePatchResultMessage => {
  if (!isRecord(value) || value.type !== 'score:patch-result') return false;
  if (!hasString(value, 'roomId') || !hasString(value, 'sessionId') || !hasString(value, 'opId') || typeof value.accepted !== 'boolean') {
    return false;
  }
  if (value.accepted) {
    return isSessionSnapshotMessage(value.snapshot) &&
      value.snapshot.roomId === value.roomId && value.snapshot.sessionId === value.sessionId;
  }
  return typeof value.reason === 'string' && value.reason !== '';
};

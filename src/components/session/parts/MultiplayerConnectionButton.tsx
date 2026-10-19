import React from 'react';
import { Check, Circle, CircleAlert, RefreshCw, UsersRound } from 'lucide-react';
import { useSessionTranslation, type SessionTranslationKey } from '../../../i18n/session';
import type { MultiplayerConnectionStatus } from '../../../features/multiplayer/multiplayerSessionManager';
import type { BoardSyncStatus } from '../../../features/multiplayer/multiplayerRoomController';

interface MultiplayerConnectionButtonProps {
  role?: 'host' | 'player';
  status?: MultiplayerConnectionStatus;
  connectionCount?: number;
  boardSyncStatus?: BoardSyncStatus;
  onClick: () => void;
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>;
  idleLabel?: string;
  previewPlayerNumber?: number | null;
}

const labels = {
  connected: 'multiplayer_status_connected',
  waiting: 'multiplayer_status_waiting',
  connecting: 'multiplayer_status_connecting',
  reconnecting: 'multiplayer_status_reconnecting',
  syncing: 'multiplayer_status_syncing',
  error: 'multiplayer_status_sync_error',
  disconnected: 'multiplayer_status_disconnected',
} as const satisfies Record<string, SessionTranslationKey>;

const getDisplayStatus = (
  role: MultiplayerConnectionButtonProps['role'],
  status: MultiplayerConnectionStatus | undefined,
  count: number,
  boardSyncStatus: BoardSyncStatus | undefined,
): keyof typeof labels | null => {
  if (!role) return null;
  // Transport interruptions take precedence over board synchronization.
  if (status === 'disconnected' || status === 'ownership-returned') return 'disconnected';
  if (status === 'reconnecting') return 'reconnecting';
  // A host's initial "connecting" state lasts until a peer joins; the room
  // is already open, so describe that as waiting rather than a stuck connection.
  if (status === 'connecting' && (role === 'player' || count > 0)) return 'connecting';
  if (role === 'player' && !status) return 'connecting';
  if (status === 'syncing') return 'syncing';
  if (role === 'host' && boardSyncStatus === 'error') return 'error';
  if (role === 'host' && (boardSyncStatus === 'pending' || boardSyncStatus === 'syncing')) return 'syncing';
  return role === 'host' && count === 0 ? 'waiting' : 'connected';
};

const MultiplayerConnectionButton: React.FC<MultiplayerConnectionButtonProps> = ({
  role, status, connectionCount = 0, boardSyncStatus, onClick, onMouseDown, idleLabel, previewPlayerNumber,
}) => {
  const { t } = useSessionTranslation();
  const displayStatus = getDisplayStatus(role, status, connectionCount, boardSyncStatus);
  const label = displayStatus ? t(labels[displayStatus]) : undefined;
  const busy = displayStatus === 'connecting' || displayStatus === 'reconnecting' || displayStatus === 'syncing';
  const warning = displayStatus === 'reconnecting' || displayStatus === 'syncing';
  const hasError = displayStatus === 'disconnected' || displayStatus === 'error';
  const StatusIcon = busy ? RefreshCw : hasError ? CircleAlert : displayStatus === 'connected' ? Check : Circle;
  const buttonClass = hasError
    ? 'border-status-danger/60 bg-status-danger/10 text-status-danger hover:bg-status-danger/20'
    : warning
      ? 'border-status-warning/60 bg-status-warning/10 text-status-warning hover:bg-status-warning/20'
      : displayStatus === 'connected'
        ? 'border-status-success/60 bg-status-success/10 text-status-success hover:bg-status-success/20'
        : displayStatus
          ? 'border-status-info/60 bg-status-info/10 text-status-info hover:bg-status-info/20'
          : 'border-surface-border text-txt-muted hover:text-brand-primary hover:bg-surface-hover';
  const description = role && label
    ? `${t(role === 'host' ? 'multiplayer_role_host' : 'multiplayer_role_player')} · ${label}${role === 'host' ? ` · ${t('multiplayer_connected_count', { count: connectionCount })}` : ''}`
    : idleLabel;

  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`relative inline-flex shrink-0 items-center justify-center p-2 rounded-lg transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${buttonClass}`}
      title={description}
      aria-label={description}
    >
      <UsersRound size={20} aria-hidden="true" />
      {displayStatus && (
        <span
          aria-hidden="true"
          data-multiplayer-status={displayStatus}
          className="absolute -right-1 -top-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-modal-bg"
        >
          <span className={`inline-flex ${busy ? 'motion-safe:animate-spin' : ''}`}>
            <StatusIcon size={14} strokeWidth={2.5} />
          </span>
        </span>
      )}
      {role === 'host' && (
        <span aria-hidden="true" data-multiplayer-count="true" className="absolute -right-1 -bottom-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-modal-bg text-current text-[10px] font-bold leading-none border border-current">
          {connectionCount > 99 ? '99+' : connectionCount}
        </span>
      )}
      {!role && previewPlayerNumber != null && (
        <span className="absolute -right-1 -bottom-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-brand-primary text-white text-[10px] font-bold leading-none border border-modal-bg">
          {previewPlayerNumber}
        </span>
      )}
    </button>
  );
};

export default MultiplayerConnectionButton;

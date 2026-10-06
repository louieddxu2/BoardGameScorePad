import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, LogOut, Send, UsersRound, X } from 'lucide-react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';
import type { BoardSyncStatus } from '../../../features/multiplayer/multiplayerRoomController';

interface MultiplayerRoomModalProps {
  isOpen: boolean;
  joinUrl: string;
  connectionCount: number;
  boardSyncStatus: BoardSyncStatus;
  isOpeningRoom?: boolean;
  hasOpenError?: boolean;
  onOpenRoom?: () => void | Promise<void>;
  onPublishBoardUpdate: () => void | Promise<void>;
  onCloseRoom?: () => void | Promise<void>;
  onClose: () => void;
}

const MultiplayerRoomModal: React.FC<MultiplayerRoomModalProps> = ({ isOpen, joinUrl, connectionCount, boardSyncStatus, isOpeningRoom = false, hasOpenError = false, onOpenRoom, onPublishBoardUpdate, onCloseRoom, onClose }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'multiplayer-room');
  const hasRoom = Boolean(joinUrl);
  const handlePublish = async () => {
    if (boardSyncStatus !== 'error') return;
    try {
      await onPublishBoardUpdate();
    } catch {
      // The controller retains the error status and owns the single in-flight send.
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop p-4" style={{ zIndex }} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="multiplayer-room-title" className="modal-container w-full max-w-sm max-h-[85vh] overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="multiplayer-room-title" className="text-lg font-bold text-txt-primary">{t('multiplayer_room_title')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-txt-secondary">{t(hasRoom ? 'multiplayer_room_desc' : 'multiplayer_intro_desc')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-txt-muted hover:text-txt-primary" aria-label={tCommon('close')}>
            <X size={20} />
          </button>
        </div>
        {hasRoom ? (
          <>
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={joinUrl} size={224} level="M" includeMargin className="h-auto w-full max-w-[224px]" role="img" aria-label={t('multiplayer_room_desc')} />
            </div>
            {boardSyncStatus !== 'synced' && (
              <div className="mt-3">
                {boardSyncStatus === 'error' ? (
                  <button type="button" onClick={() => { void handlePublish(); }} className="btn-action-primary min-h-12 w-full justify-center gap-2 whitespace-normal text-base leading-relaxed">
                    <Send size={16} className="shrink-0" />
                    <span>{t('multiplayer_publish_update')}</span>
                  </button>
                ) : (
                  <p role="status" className="flex items-center justify-center gap-2 text-sm text-txt-secondary">
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                    <span>{t('multiplayer_publish_publishing')}</span>
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-recessed px-3 py-2.5 text-sm font-medium text-txt-secondary">
              <UsersRound size={17} className="shrink-0 text-brand-primary" />
              <span>{connectionCount > 0 ? t('multiplayer_connected_count', { count: connectionCount }) : t('multiplayer_waiting')}</span>
            </div>
            {onCloseRoom && (
              <div className="mt-5 border-t border-surface-border pt-4">
                <button type="button" onClick={() => { void onCloseRoom(); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-status-danger bg-status-danger px-3 py-3 text-base font-bold text-white transition-colors hover:bg-status-danger/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger">
                  <LogOut size={18} className="shrink-0" />
                  <span>{t('multiplayer_close_room')}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {hasOpenError && <p role="alert" className="mt-4 rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">{t('multiplayer_create_failed')}</p>}
            <div className="mt-5">
              <button type="button" onClick={() => { void onOpenRoom?.(); }} disabled={isOpeningRoom || !onOpenRoom} className="btn-action-primary min-h-12 w-full justify-center gap-2 text-base disabled:opacity-70">
                {isOpeningRoom ? <Loader2 size={16} className="animate-spin" /> : <UsersRound size={18} />}
                <span>{t(isOpeningRoom ? 'multiplayer_creating_room' : 'multiplayer_create_room')}</span>
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default MultiplayerRoomModal;

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Loader2, LogOut, Send, UsersRound, X } from 'lucide-react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';

interface MultiplayerRoomModalProps {
  isOpen: boolean;
  joinUrl: string;
  connectionCount: number;
  hasUnpublishedBoardUpdate: boolean;
  onPublishBoardUpdate: () => void | Promise<void>;
  onCloseRoom?: () => void | Promise<void>;
  onClose: () => void;
}

const MultiplayerRoomModal: React.FC<MultiplayerRoomModalProps> = ({ isOpen, joinUrl, connectionCount, hasUnpublishedBoardUpdate, onPublishBoardUpdate, onCloseRoom, onClose }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'multiplayer-room');
  const [publishState, setPublishState] = React.useState<'idle' | 'publishing' | 'published'>('idle');
  const publishedTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (publishedTimerRef.current !== null) window.clearTimeout(publishedTimerRef.current);
  }, []);

  const handlePublish = async () => {
    if (publishState === 'publishing') return;
    setPublishState('publishing');
    try {
      await onPublishBoardUpdate();
      setPublishState('published');
      publishedTimerRef.current = window.setTimeout(() => setPublishState('idle'), 1800);
    } catch {
      setPublishState('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop p-4" style={{ zIndex }} onClick={onClose}>
      <section className="modal-container w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-txt-primary">{t('multiplayer_room_title')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-txt-secondary">{t('multiplayer_room_desc')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-txt-muted hover:text-txt-primary" aria-label={tCommon('close')}>
            <X size={20} />
          </button>
        </div>
        <div className="flex justify-center rounded-lg bg-white p-4">
          <QRCodeSVG value={joinUrl} size={224} level="M" includeMargin />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-recessed px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-txt-secondary">
            <UsersRound size={17} className="shrink-0 text-brand-primary" />
            <span className="truncate">{connectionCount > 0 ? t('multiplayer_connected_count', { count: connectionCount }) : t('multiplayer_waiting')}</span>
          </div>
          {onCloseRoom && (
            <button type="button" onClick={() => { void onCloseRoom(); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/10" title={t('multiplayer_close_room')}>
              <LogOut size={15} />
              <span>{t('multiplayer_close_room')}</span>
            </button>
          )}
        </div>
        <div className="mt-3">
          {hasUnpublishedBoardUpdate && <p className="mb-2 text-sm text-status-warning">{t('multiplayer_publish_pending')}</p>}
          <button type="button" onClick={() => { void handlePublish(); }} disabled={publishState === 'publishing'} className="btn-action-primary min-h-10 w-full justify-center gap-2 disabled:opacity-70">
            {publishState === 'publishing'
              ? <Loader2 size={16} className="animate-spin" />
              : publishState === 'published' ? <Check size={16} /> : <Send size={16} />}
            <span>{publishState === 'publishing'
              ? t('multiplayer_publish_publishing')
              : publishState === 'published' ? t('multiplayer_publish_published') : t('multiplayer_publish_update')}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default MultiplayerRoomModal;

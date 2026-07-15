import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UsersRound, X } from 'lucide-react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';

interface MultiplayerRoomModalProps {
  isOpen: boolean;
  joinUrl: string;
  connectionCount: number;
  onClose: () => void;
}

const MultiplayerRoomModal: React.FC<MultiplayerRoomModalProps> = ({ isOpen, joinUrl, connectionCount, onClose }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'multiplayer-room');
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
        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-txt-secondary">
          <UsersRound size={17} className="text-brand-primary" />
          <span>{connectionCount > 0 ? t('multiplayer_connected_count', { count: connectionCount }) : t('multiplayer_waiting')}</span>
        </div>
      </section>
    </div>
  );
};

export default MultiplayerRoomModal;

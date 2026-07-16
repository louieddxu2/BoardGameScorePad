import React from 'react';
import { LogOut, UsersRound, X } from 'lucide-react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';

interface MultiplayerParticipantRoomModalProps {
  isOpen: boolean;
  onLeave: () => void | Promise<void>;
  onClose: () => void;
}

const MultiplayerParticipantRoomModal: React.FC<MultiplayerParticipantRoomModalProps> = ({ isOpen, onLeave, onClose }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'multiplayer-participant-room');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop p-4" style={{ zIndex }} onClick={onClose}>
      <section className="modal-container w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2"><UsersRound size={20} className="text-brand-primary" /><h2 className="text-lg font-bold">{t('multiplayer_connection_title')}</h2></div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-txt-muted hover:text-txt-primary" aria-label={tCommon('close')}><X size={20} /></button>
        </div>
        <p className="text-sm leading-relaxed text-txt-secondary">{t('multiplayer_connection_desc')}</p>
        <button type="button" onClick={() => { void onLeave(); }} className="btn-action-primary mt-5 min-h-10 w-full justify-center gap-2 bg-status-danger text-white shadow-none hover:bg-status-danger/90">
          <LogOut size={16} />
          <span>{t('multiplayer_leave_room')}</span>
        </button>
      </section>
    </div>
  );
};

export default MultiplayerParticipantRoomModal;

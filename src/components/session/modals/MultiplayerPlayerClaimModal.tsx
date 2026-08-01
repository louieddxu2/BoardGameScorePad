import React, { useEffect, useState } from 'react';
import { Check, UsersRound, X } from 'lucide-react';
import { Player } from '../../../types';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';

interface MultiplayerPlayerClaimModalProps {
  isOpen: boolean;
  players: Player[];
  onConfirm: (playerIds: string[]) => void;
  onClose: () => void;
  variant?: 'join' | 'claim';
  initialSelectedIds?: string[];
}

const MultiplayerPlayerClaimModal: React.FC<MultiplayerPlayerClaimModalProps> = ({ isOpen, players, onConfirm, onClose, variant = 'join', initialSelectedIds = [] }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'multiplayer-player-claim');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const initialSelectionKey = initialSelectedIds.join('|');
  useEffect(() => { if (isOpen) setSelectedIds(initialSelectedIds); }, [initialSelectionKey, isOpen]);
  if (!isOpen) return null;
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const isClaim = variant === 'claim';

  return (
    <div className="modal-backdrop p-4" style={{ zIndex }} onClick={onClose}>
      <section className="modal-container w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-2"><div className="flex items-center gap-2"><UsersRound size={20} className="text-brand-primary" /><h2 className="text-lg font-bold">{t(isClaim ? 'multiplayer_claim_title' : 'multiplayer_join_title')}</h2></div><button type="button" onClick={onClose} className="p-2 -mr-2 text-txt-muted hover:text-txt-primary" aria-label={tCommon('close')}><X size={20} /></button></div>
        <p className="mb-4 text-sm leading-relaxed text-txt-secondary">{t(isClaim ? 'multiplayer_claim_desc' : 'multiplayer_join_desc')}</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {players.map((player) => {
            const selected = selectedIds.includes(player.id);
            return <button key={player.id} type="button" onClick={() => toggle(player.id)} className={`w-full flex items-center gap-3 p-3 text-left border rounded-lg transition-colors ${selected ? 'border-brand-primary bg-brand-primary/10' : 'border-surface-border hover:bg-surface-hover'}`}>
              <span className="w-5 h-5 rounded border flex items-center justify-center shrink-0" style={{ borderColor: player.color, backgroundColor: selected ? player.color : 'transparent' }}>{selected && <Check size={14} className="text-white" />}</span>
              <span className="font-medium text-txt-primary truncate">{player.name}</span>
            </button>;
          })}
        </div>
        <button type="button" disabled={!selectedIds.length} onClick={() => onConfirm(selectedIds)} className="w-full mt-5 py-3 rounded-lg bg-brand-primary text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          {t(isClaim ? 'multiplayer_claim_confirm' : 'multiplayer_join_confirm')}
        </button>
      </section>
    </div>
  );
};

export default MultiplayerPlayerClaimModal;

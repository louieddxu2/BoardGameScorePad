import React, { useState } from 'react';
import { Shuffle, Users } from 'lucide-react';
import { GameSession, GameTemplate } from '../../types';
import { useToolsTranslation } from '../../i18n/tools';
import PlayerSelectorModal from './player-selector/PlayerSelectorModal';
import { shufflePlayersAndAssignStarter } from './orderPlayers';

interface OrderToolProps {
    session: GameSession;
    template: GameTemplate;
    onUpdateSession: (session: GameSession) => void;
}

const OrderTool: React.FC<OrderToolProps> = ({ session, template, onUpdateSession }) => {
    const { t } = useToolsTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleShuffle = () => {
        const newPlayers = shufflePlayersAndAssignStarter(session.players);

        onUpdateSession({
            ...session,
            players: newPlayers
        });

        if (navigator.vibrate) navigator.vibrate(50);
    };

    return (
        <div className="w-full flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 w-full">
                <button
                    onClick={handleShuffle}
                    className="py-4 bg-[rgb(var(--c-input-header-bg))] hover:bg-surface-hover text-txt-primary rounded-2xl border border-[rgb(var(--c-input-border))] transition-all active:scale-95 flex items-center justify-center gap-2 group shadow-sm"
                >
                    <Shuffle size={18} className="text-brand-secondary group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm">{t('order_shuffle')}</span>
                </button>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="py-4 bg-[rgb(var(--c-input-header-bg))] hover:bg-surface-hover text-txt-primary rounded-2xl border border-[rgb(var(--c-input-border))] transition-all active:scale-95 flex items-center justify-center gap-2 group shadow-sm"
                >
                    <Users size={18} className="text-brand-secondary group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm">{t('order_visual_picker')}</span>
                </button>
            </div>

            <PlayerSelectorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                session={session}
                template={template}
                onUpdateSession={onUpdateSession}
            />
        </div>
    );
};

export default OrderTool;


import React from 'react';
import { Shuffle } from 'lucide-react';
import { GameSession } from '../../types';
import { useToolsTranslation } from '../../i18n/tools';

interface OrderToolProps {
    session: GameSession;
    onUpdateSession: (session: GameSession) => void;
}

const OrderTool: React.FC<OrderToolProps> = ({ session, onUpdateSession }) => {
    const { t } = useToolsTranslation();
    const handleShuffle = () => {
        const newPlayers = [...session.players];

        // 1. Fisher-Yates Shuffle
        for (let i = newPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newPlayers[i], newPlayers[j]] = [newPlayers[j], newPlayers[i]];
        }

        // 2. Set First Player as Starter (Reset others)
        newPlayers.forEach((p, i) => {
            p.isStarter = (i === 0);
        });

        // 3. Update Session
        onUpdateSession({
            ...session,
            players: newPlayers
        });

        if (navigator.vibrate) navigator.vibrate(50);
    };

    return (
        <button
            onClick={handleShuffle}
            className="w-full py-4 bg-[rgb(var(--c-input-header-bg))] hover:bg-surface-hover text-txt-primary rounded-2xl border border-[rgb(var(--c-input-border))] transition-all active:scale-95 flex items-center justify-center gap-2 group shadow-sm"
        >
            <Shuffle size={18} className="text-brand-secondary group-hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">{t('order_title')}</span>
        </button>
    );
};

export default OrderTool;

import React from 'react';
import { Search, Plus, Play } from 'lucide-react';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { GameOption } from '../types';

export interface GameLaunchActionsProps {
    dockedItem: GameOption | null;
    onSearchClick: () => void;
    handleStart: () => void;
}

const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";

export const GameLaunchActions: React.FC<GameLaunchActionsProps> = ({
    dockedItem,
    onSearchClick,
    handleStart
}) => {
    const { t } = useIntegrationTranslation();

    return (
        <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-surface-border z-10 bg-app-bg-deep`}>
            <button
                onClick={onSearchClick}
                className="w-[50px] h-full flex items-center justify-center bg-app-bg hover:bg-surface-bg text-brand-primary transition-colors active:brightness-90 border-r border-surface-border"
                title={t('selector_search_more')}
            >
                <Search size={22} strokeWidth={2.5} />
            </button>

            <button
                onClick={handleStart}
                disabled={!dockedItem}
                className={`
              w-[90px] h-full flex flex-col items-center justify-center transition-all active:brightness-90
              ${dockedItem
                        ? 'bg-brand-primary hover:filter hover:brightness-110 text-white'
                        : 'bg-surface-bg text-txt-muted cursor-not-allowed'
                    }
          `}
            >
                {dockedItem?.uid === '__CREATE_NEW__' ? <Plus size={28} /> : <Play size={28} fill="currentColor" />}
            </button>
        </div>
    );
};

import React from 'react';
import { CloudDownload, Play, Plus, RefreshCw, Search, WifiOff } from 'lucide-react';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { GameOption } from '../types';

export interface GameLaunchActionsProps {
    dockedItem: GameOption | null;
    onSearchClick: () => void;
    handleStart: () => void;
}

const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";
const OFFICIAL_BOARD_STATUS_ICONS = {
    needs_download: CloudDownload,
    needs_connection: WifiOff,
    update_available: RefreshCw,
};

export const GameLaunchActions: React.FC<GameLaunchActionsProps> = ({
    dockedItem,
    onSearchClick,
    handleStart
}) => {
    const { t } = useIntegrationTranslation();
    const isCreate = dockedItem?.uid === '__CREATE_NEW__';
    const status = dockedItem?.officialBoardStatus;
    const StatusIcon = status ? OFFICIAL_BOARD_STATUS_ICONS[status] : undefined;
    const canStart = !!dockedItem && status !== 'needs_connection';
    const startLabel = isCreate
        ? t('selector_create_and_score', { name: dockedItem.displayName })
        : t(status ? `selector_start_${status}` : 'selector_start_scoring');

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
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                aria-label={startLabel}
                className={`
              w-[90px] h-full flex items-center justify-center gap-1 transition-all active:brightness-90
              ${canStart
                        ? 'bg-brand-primary hover:filter hover:brightness-110 text-txt-on-color'
                        : 'bg-surface-bg text-txt-muted cursor-not-allowed'
                    }
          `}
            >
                {isCreate ? <Plus size={28} aria-hidden="true" /> : (
                    <>
                        {StatusIcon && <StatusIcon size={18} strokeWidth={2.4} aria-hidden="true" />}
                        <Play size={28} fill="currentColor" aria-hidden="true" />
                    </>
                )}
            </button>
        </div>
    );
};

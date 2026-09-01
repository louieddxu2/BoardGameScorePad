
import React, { useRef } from 'react';
import { Wrench } from 'lucide-react';
import { GameSession, GameTemplate } from '../../../types';

// Import Modular Tools
import MediaTool from '../../tools/MediaTool';
import RandomizerTool from '../../tools/RandomizerTool';
import CountdownTool from '../../tools/CountdownTool';
import OrderTool from '../../tools/OrderTool';
import MemoTool from '../../tools/MemoTool';
import { useSessionTranslation } from '../../../i18n/session';

interface SmartSpacerProps {
    session: GameSession;
    template: GameTemplate;
    onTakePhoto?: () => void;
    onScreenshot?: () => void;
    onUpdateSession: (session: GameSession) => void;
    mode?: 'session' | 'history'; // New prop
    mediaOnly?: boolean;
    topContent?: React.ReactNode;
}

const SmartSpacer: React.FC<SmartSpacerProps> = ({ session, template, onTakePhoto, onScreenshot, onUpdateSession, mode = 'session', mediaOnly = false, topContent }) => {
    const { t } = useSessionTranslation();
    const isHistory = mode === 'history';
    const isPinchingRef = useRef(false);
    const keepToolboxTouchLocal = (event: React.TouchEvent) => {
        if (event.touches.length >= 2) {
            isPinchingRef.current = true;
            return;
        }

        if (isPinchingRef.current) {
            if (event.type === 'touchend' || event.type === 'touchcancel') {
                isPinchingRef.current = false;
            }
            return;
        }

        event.stopPropagation();
    };

    return (
        <div
            data-toolbox-scroller="true"
            className="absolute inset-0 flex flex-col p-4 overflow-y-auto no-scrollbar touch-pan-y overscroll-contain"
            onTouchStart={keepToolboxTouchLocal}
            onTouchMove={keepToolboxTouchLocal}
            onTouchEnd={keepToolboxTouchLocal}
            onTouchCancel={keepToolboxTouchLocal}
        >
            {/* Toolbox Grid - Masonry-ish Layout */}
            <div className="grid grid-cols-4 gap-3 w-full max-w-sm mx-auto pb-20">

                {topContent && (
                    <div className="col-span-4 min-w-0">
                        {topContent}
                    </div>
                )}

                {/* Row 1: Media */}
                <div className="col-span-4">
                    <MediaTool onTakePhoto={onTakePhoto} onScreenshot={onScreenshot} />
                </div>

                {!mediaOnly && <div className="col-span-4 h-px bg-[rgb(var(--c-input-border)/0.5)] my-1 flex items-center justify-center">
                    <span className="bg-[rgb(var(--c-input-bg))] px-2 text-[10px] text-txt-muted font-bold uppercase tracking-widest flex items-center gap-1">
                        <Wrench size={10} /> {t('smart_spacer_tools_title')}
                    </span>
                </div>}

                {/* Row 2: Order */}
                {!isHistory && !mediaOnly && (
                    <div className="col-span-4">
                        <OrderTool session={session} template={template} onUpdateSession={onUpdateSession} />
                    </div>
                )}

                {/* Row 3: Countdown */}
                {!isHistory && !mediaOnly && (
                    <div className="col-span-4">
                        <CountdownTool />
                    </div>
                )}

                {/* Row 4: Randomizer (Coin + Dice) */}
                {!isHistory && !mediaOnly && (
                    <div className="col-span-4">
                        <RandomizerTool />
                    </div>
                )}

                {/* Row 5: Notes */}
                {!mediaOnly && <div className="col-span-4">
                    <MemoTool session={session} onUpdateSession={onUpdateSession} />
                </div>}

            </div>
        </div>
    );
};

export default SmartSpacer;

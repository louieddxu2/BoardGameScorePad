
import React from 'react';
import { MousePointerClick, Wrench } from 'lucide-react';
import { GameSession, GameTemplate } from '../../../types';

// Import Modular Tools
import MediaTool from '../../tools/MediaTool';
import RandomizerTool from '../../tools/RandomizerTool';
import CountdownTool from '../../tools/CountdownTool';
import OrderTool from '../../tools/OrderTool'; 
import MemoTool from '../../tools/MemoTool';

interface SmartSpacerProps {
    session: GameSession;
    template: GameTemplate;
    onTakePhoto?: () => void;
    onScreenshot?: () => void;
    onUpdateSession: (session: GameSession) => void; 
}

const SmartSpacer: React.FC<SmartSpacerProps> = ({ session, onTakePhoto, onScreenshot, onUpdateSession }) => {
  return (
    <div className="absolute inset-0 flex flex-col p-4 overflow-y-auto no-scrollbar">
        {/* Hint Text */}
        <div className="flex items-center justify-center gap-2 text-slate-600 mb-6 mt-2 opacity-50 select-none">
            <MousePointerClick size={16} className="animate-bounce" />
            <span className="text-xs font-bold">點擊上方分數格開始輸入</span>
        </div>

        {/* Toolbox Grid - Masonry-ish Layout */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-sm mx-auto pb-20">
            
            {/* Row 1: Media */}
            <div className="col-span-4">
                <MediaTool onTakePhoto={onTakePhoto} onScreenshot={onScreenshot} />
            </div>

            <div className="col-span-4 h-px bg-slate-800/50 my-1 flex items-center justify-center">
                <span className="bg-slate-900 px-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Wrench size={10} /> 桌遊工具箱
                </span>
            </div>

            {/* Row 2: Order */}
            <div className="col-span-4">
                <OrderTool session={session} onUpdateSession={onUpdateSession} />
            </div>
            
            {/* Row 3: Countdown */}
            <div className="col-span-4">
                <CountdownTool />
            </div>

            {/* Row 4: Randomizer (Coin + Dice) */}
            <div className="col-span-4">
                <RandomizerTool />
            </div>

            {/* Row 5: Notes */}
            <div className="col-span-4">
                <MemoTool session={session} onUpdateSession={onUpdateSession} />
            </div>

        </div>
    </div>
  );
};

export default SmartSpacer;

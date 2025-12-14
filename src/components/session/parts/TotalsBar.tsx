
import React, { useEffect } from 'react';
import { Player } from '../../../types';
import { Crown } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface TotalsBarProps {
  players: Player[];
  winners: string[];
  isPanelOpen: boolean;
  panelHeight: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isHidden?: boolean;
}

const TotalsBar: React.FC<TotalsBarProps> = ({
  players,
  winners,
  isPanelOpen,
  panelHeight,
  scrollRef,
  contentRef,
  isHidden = false
}) => {
  return (
    <div
      id="live-totals-bar"
      className={`absolute left-0 right-0 h-10 border-t border-slate-700 flex z-30 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${isPanelOpen ? 'bg-slate-900/75 backdrop-blur' : 'bg-slate-900'} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ bottom: panelHeight }}
    >
      <div className="w-[70px] bg-slate-800 border-r border-slate-700 flex items-center justify-center shrink-0 z-40 relative border-t-2 border-transparent">
        <span className="font-black text-emerald-400 text-sm">總分</span>
      </div>
      <div className="flex-1 overflow-x-auto no-scrollbar" ref={scrollRef}>
        <div 
            className="flex min-w-fit h-full"
            ref={contentRef}
        >
          {players.map(p => (
            <div
              key={p.id}
              // 關鍵修改：
              // 1. 移除 flex-auto, shrink-0
              // 2. 加入 flex-none (禁止彈性)
              // 3. 加入 player-col-${player.id} 供 JS Hook 抓取並設定寬度
              // 4. 預設 style={{ width: '3.375rem' }} (約 54px)
              className={`player-col-${p.id} flex-none border-r border-slate-800 flex flex-col items-center justify-center relative h-full overflow-hidden`}
              style={{ width: '3.375rem', backgroundColor: `${p.color}20`, borderTopColor: p.color, borderTopWidth: '2px' }}
            >
              <span className="font-black text-lg leading-none w-full text-center truncate px-1" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                {p.totalScore}
              </span>
              {winners.includes(p.id) && players.length > 1 && (
                <Crown size={14} className="text-yellow-400 absolute top-0.5 right-0.5" fill="currentColor" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TotalsBar;

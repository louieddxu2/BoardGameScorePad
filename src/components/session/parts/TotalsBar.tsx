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
}

const TotalsBar: React.FC<TotalsBarProps> = ({
  players,
  winners,
  isPanelOpen,
  panelHeight,
  scrollRef
}) => {
  useEffect(() => {
    const tableContainer = document.querySelector('.custom-scrollbar');
    const handleTableScroll = () => {
      if (tableContainer && scrollRef.current) {
        scrollRef.current.scrollLeft = tableContainer.scrollLeft;
      }
    };
    tableContainer?.addEventListener('scroll', handleTableScroll);
    return () => tableContainer?.removeEventListener('scroll', handleTableScroll);
  }, [scrollRef]);

  return (
    <div
      id="live-totals-bar"
      className={`absolute left-0 right-0 h-10 border-t border-slate-700 flex z-30 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${isPanelOpen ? 'bg-slate-900/75 backdrop-blur' : 'bg-slate-900'}`}
      style={{ bottom: panelHeight }}
    >
      <div className="w-[70px] bg-slate-800 border-r border-slate-700 flex items-center justify-center shrink-0 z-40 relative border-t-2 border-transparent">
        <span className="font-black text-emerald-400 text-sm">總分</span>
      </div>
      <div className="flex-1 overflow-x-auto no-scrollbar" ref={scrollRef}>
        <div className="flex min-w-fit h-full">
          {players.map(p => (
            <div
              key={p.id}
              className="min-w-[54px] flex-1 border-r border-slate-800 flex items-center justify-center relative h-full"
              style={{ backgroundColor: `${p.color}20`, borderTopColor: p.color, borderTopWidth: '2px' }}
            >
              <span className="font-black text-lg" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                {p.totalScore}
              </span>
              {winners.includes(p.id) && players.length > 1 && (
                <Crown size={14} className="text-yellow-400 absolute top-1 right-1" fill="currentColor" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TotalsBar;
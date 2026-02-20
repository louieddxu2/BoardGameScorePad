
import React, { forwardRef } from 'react';
import { Player } from '../../../types';
import { Crown, Calendar, Trophy } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import StickerElement from './StickerElement';

export interface OverlayData {
  gameName: string;
  date: number;
  endTime?: number; // 新增：結束時間 (可選)
  players: (Player & { isAnonymous?: boolean })[]; // Update to allow isAnonymous flag
  winners: string[];
}

interface ScoreOverlayGeneratorProps {
  imageSrc: string;
  data: OverlayData;
}

// 固定寬度以確保輸出解析度一致 (1080px 寬度適合大多數手機與社群分享)
const GENERATOR_WIDTH = 1080;
const PADDING_PX = 32; // Fixed 32px (equivalent to p-8 at 1rem=16px)
const GAP_PX = 24;     // Fixed 24px (equivalent to gap-6 at 1rem=16px)

const ScoreOverlayGenerator = forwardRef<HTMLDivElement, ScoreOverlayGeneratorProps>(({ imageSrc, data }, ref) => {
  // Logic: 優先顯示結束時間 (歷史紀錄)，若無則顯示開始時間 (進行中遊戲)
  const displayTime = data.endTime || data.date;
  
  const dateStr = new Date(displayTime).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = new Date(displayTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

  // [Auto-Balance Logic]
  // 計算每列應該顯示幾個玩家，以避免孤兒 (例如 5 人變成 4+1)。
  const totalPlayers = data.players.length;
  const MAX_COLS = 4;
  const numRows = Math.ceil(totalPlayers / MAX_COLS);
  const targetCols = Math.ceil(totalPlayers / numRows);
  
  // Precise Calculation for Pixel-Perfect Layout
  // Avoid using calc(100%...) which suffers from sub-pixel rounding errors causing wrap
  const containerInnerWidth = GENERATOR_WIDTH - (PADDING_PX * 2);
  const totalGapWidth = (targetCols - 1) * GAP_PX;
  // Floor the width to ensure it strictly fits, subtract a tiny buffer for browser render quirks
  const cardWidth = Math.floor((containerInnerWidth - totalGapWidth) / targetCols) - 0.1;

  return (
    <div 
        ref={ref}
        style={{ width: GENERATOR_WIDTH }}
        className="bg-slate-900 text-white flex flex-col items-stretch overflow-hidden"
    >
      {/* Header: Game Info */}
      <div 
        className="bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-md z-10 relative"
        style={{ padding: PADDING_PX }}
      >
        <div>
            <h2 className="text-5xl font-black text-white mb-3 flex items-center gap-4">
                <Trophy size={48} className="text-emerald-500" />
                {data.gameName}
            </h2>
            <div className="flex items-center gap-4 text-slate-400 text-2xl font-mono font-bold">
                <Calendar size={28} />
                <span>{dateStr} {timeStr}</span>
            </div>
        </div>
        <div className="absolute top-6 right-8 opacity-40">
            <span className="text-slate-500 text-3xl font-black tracking-widest">萬用桌遊計分板</span>
        </div>
      </div>

      {/* Body: The Original Photo */}
      {/* object-contain 確保圖片完整顯示，不裁切。bg-black 填補可能的空隙 */}
      <div className="bg-black relative flex justify-center items-center min-h-[500px]">
          <img 
            src={imageSrc} 
            alt="Original" 
            crossOrigin="anonymous" 
            className="block max-w-full h-auto shadow-2xl"
          />
      </div>

      {/* Footer: Player Scores */}
      <div 
        className="bg-slate-900 border-t border-slate-700"
        style={{ padding: PADDING_PX }}
      >
        <div 
            className="flex flex-wrap justify-center"
            style={{ gap: GAP_PX }}
        >
            {data.players.map(p => {
                const isWinner = data.winners.includes(p.id);
                // Fallback color if transparent
                const playerColor = p.color === 'transparent' ? '#64748b' : p.color; 
                const isDark = isColorDark(playerColor);
                
                return (
                    <div 
                        key={p.id} 
                        className="relative flex flex-col items-center justify-center bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden"
                        style={{
                            width: `${cardWidth}px`,
                            minWidth: '200px' // 保持最小寬度
                        }}
                    >
                        {/* Winner Crown (Floating Badge) - Adjusted position for new layout */}
                        {isWinner && (
                            <div className="absolute -top-2 -right-2 bg-slate-900 rounded-full p-2 border-2 border-yellow-500 shadow-lg z-20 transform rotate-12">
                                <Crown size={28} className="text-yellow-400 fill-current" />
                            </div>
                        )}

                        {/* Name Header Section */}
                        <div 
                            className="w-full py-3 px-4 flex items-center justify-center border-b border-slate-700/50"
                            style={{ 
                                backgroundColor: `${playerColor}26` // Add ~15% opacity to the background
                            }}
                        >
                            {p.isAnonymous ? (
                                <StickerElement id={p.id} color={playerColor} />
                            ) : (
                                <span 
                                    className="text-3xl font-black w-full text-center"
                                    style={{ 
                                        color: playerColor,
                                        textShadow: isDark ? ENHANCED_TEXT_SHADOW : 'none',
                                        wordBreak: 'break-word',
                                        lineHeight: '1.2'
                                    }}
                                >
                                    {p.name}
                                </span>
                            )}
                        </div>

                        {/* Score Section */}
                        <div className="p-5 flex items-center justify-center w-full">
                            <span className="text-7xl font-black font-mono leading-none tracking-tight text-white drop-shadow-md">
                                {p.totalScore}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
});

export default ScoreOverlayGenerator;

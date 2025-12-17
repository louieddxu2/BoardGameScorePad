import React from 'react';
import { GameSession, GameTemplate } from '../../../types';
import { Trophy, Crown, Settings } from 'lucide-react';
import ScoreCell from '../ScoreCell';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface ScreenshotViewProps {
  session: GameSession;
  template: GameTemplate;
  zoomLevel: number;
  mode: 'full' | 'simple';
}

const ScreenshotView: React.FC<ScreenshotViewProps> = ({ session, template, zoomLevel, mode }) => {
  const winners = session.players
    .filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore)))
    .map(p => p.id);

  // --- Styles ---
  const containerClass = 'bg-slate-900';
  const headerIconBoxClass = 'bg-emerald-500/10 border border-emerald-500/20';
  const getPlayerBg = (color: string) => `${color}20`;
  const getPlayerBorderBottom = (color: string) => color;
  const getColumnBorderRight = (color: string | undefined) => (color || 'var(--border-slate-700)');
  const rowBorderClass = 'border-slate-700';

  return (
    <div
      id="screenshot-target"
      // Use w-fit + min-w-[100vw] to ensure it fills screen or expands for content
      className={`fixed top-0 left-0 -z-50 text-slate-100 ${containerClass}`}
      style={{ 
        fontSize: `${16 * zoomLevel}px`,
        fontFamily: 'Inter, sans-serif',
        width: 'fit-content',
        minWidth: '100vw'
      }}
    >
      {/* Header */}
      <div id="ss-header" className="p-4 flex items-center gap-2">
        <div className={`p-2 rounded ${headerIconBoxClass}`}>
          <Trophy className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <p className="text-slate-500 text-xs">萬用桌遊計分板 • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      {/* Score Grid Container */}
      <div id="screenshot-content">
        
        {/* Player Headers */}
        <div id="ss-player-header-row" className={`flex border-b ${rowBorderClass} bg-slate-800`}>
          <div className={`w-[70px] border-r ${rowBorderClass} p-2 shrink-0 flex items-center justify-center`}>
            <span className="font-bold text-sm text-slate-400">玩家</span>
          </div>
          {session.players.map(p => (
            <div
              key={p.id}
              className={`min-w-[54px] flex-1 border-r ${rowBorderClass} p-2 flex flex-col items-center justify-center`}
              style={{ 
                  backgroundColor: getPlayerBg(p.color),
                  borderBottom: `2px solid ${getPlayerBorderBottom(p.color)}`
              }}
            >
              <span className="text-sm font-bold truncate max-w-full text-center" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {template.columns.map(col => (
          <div key={col.id} id={`ss-row-${col.id}`} className="flex">
            <div
              className={`w-[70px] border-r-2 border-b ${rowBorderClass} p-2 text-center shrink-0 flex flex-col justify-center bg-slate-800`}
              style={{ borderRightColor: getColumnBorderRight(col.color) }}
            >
              <span className="text-sm font-bold text-slate-300 w-full break-words whitespace-pre-wrap leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                  {col.name}
              </span>
               {col.isScoring && (
                  <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                      {(() => {
                          // --- Fix: Use `formula` and `options` for logic, not `type` or `calculationType`
                          if (col.formula === 'a1×a2' && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="">{col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="">{col.subUnits[1]}</span></div>;
                          if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center gap-1"><Settings size={10} />{col.unit && <span className="text-xs">{col.unit}</span>}</div>;
                          if (col.formula === 'a1×c1') return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="text-emerald-500 font-bold font-mono">{col.constants?.c1 ?? 1}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="">{col.unit}</span></div>;
                          if (col.unit) return <span className="text-xs">{col.unit}</span>;
                          return null;
                      })()}
                  </div>
              )}
            </div>
            {session.players.map(p => (
              <ScoreCell
                key={p.id}
                player={p}
                column={col}
                isActive={false}
                onClick={() => {}}
                screenshotMode={true}
                simpleMode={mode === 'simple'}
              />
            ))}
          </div>
        ))}

        {/* Totals Bar */}
        <div id="ss-totals-row" className={`flex h-10 border-t ${rowBorderClass} bg-slate-900`}>
            <div className={`w-[70px] border-r ${rowBorderClass} p-2 shrink-0 flex items-center justify-center bg-slate-800`}>
                <span className="font-black text-emerald-400 text-sm">總分</span>
            </div>
            {session.players.map(p => (
                <div
                    key={p.id}
                    className={`min-w-[54px] flex-1 border-r ${rowBorderClass} p-2 h-full flex items-center justify-center relative`}
                    style={{ 
                        backgroundColor: getPlayerBg(p.color),
                        borderTop: `2px solid ${getPlayerBorderBottom(p.color)}`
                    }}
                >
                    <span className="font-black text-lg" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                        {p.totalScore}
                    </span>
                    {winners.includes(p.id) && session.players.length > 1 && (
                        <Crown size={14} className="text-yellow-400 absolute top-1 right-1" fill="currentColor" />
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotView;
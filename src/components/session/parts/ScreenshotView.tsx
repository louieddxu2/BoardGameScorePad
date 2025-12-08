import React from 'react';
import { GameSession, GameTemplate } from '../../../types';
import { Trophy } from 'lucide-react';
import ScoreCell from '../ScoreCell';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface ScreenshotViewProps {
  session: GameSession;
  template: GameTemplate;
}

const ScreenshotView: React.FC<ScreenshotViewProps> = ({ session, template }) => {
  return (
    <div
      id="screenshot-target"
      className="fixed top-0 left-[-9999px] bg-slate-900 text-slate-100 p-4"
      style={{ width: Math.max(400, 70 + session.players.length * 60) + 'px' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
          <Trophy className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <p className="text-slate-500 text-xs">萬用桌遊計分板 • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      <div className="border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex bg-slate-800 border-b border-slate-700">
          <div className="w-[70px] p-3 border-r border-slate-700 font-bold text-slate-400 text-sm flex items-center justify-center text-center">計分項目</div>
          {session.players.map(p => (
            <div
              key={p.id}
              className="w-[60px] flex-1 p-3 border-r border-slate-700 text-center font-bold"
              style={{ color: p.color, backgroundColor: `${p.color}10`, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}
            >
              {p.name}
            </div>
          ))}
        </div>
        {template.columns.map(col => (
          <div key={col.id} className="flex border-b border-slate-800">
            <div className="w-[70px] p-3 border-r border-slate-800 bg-slate-800/50 text-xs font-bold text-slate-300 flex flex-col items-center justify-center text-center break-words">
              <span style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>{col.name}</span>
              {col.isScoring && (
                <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-center">
                  {(() => {
                    if (col.calculationType === 'product' && col.subUnits) return <span className="flex items-center gap-0.5"><span>{col.subUnits[0]}</span><span>×</span><span>{col.subUnits[1]}</span></span>;
                    if (col.weight !== 1 && col.weight !== undefined) return <span className="flex items-center gap-0.5"><span className="text-emerald-500 font-bold">{col.weight}</span><span>×</span><span>{col.unit}</span></span>;
                    return <span>{col.unit}</span>;
                  })()}
                </div>
              )}
            </div>
            {session.players.map(p => (
              <div key={p.id} className="w-[60px] flex-1 p-2 border-r border-slate-800 flex items-center justify-center relative min-h-[50px]">
                <ScoreCell player={p} column={col} isActive={false} onClick={() => {}} />
              </div>
            ))}
          </div>
        ))}
        <div className="flex bg-slate-800 border-t-2 border-slate-700">
          <div className="w-[70px] p-3 border-r border-slate-700 font-black text-emerald-400 italic text-center flex items-center justify-center">TOTAL</div>
          {session.players.map(p => (
            <div
              key={p.id}
              className="w-[60px] flex-1 p-3 border-r border-slate-700 text-center font-black text-xl"
              style={{ color: p.color, backgroundColor: `${p.color}10`, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}
            >
              {p.totalScore}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotView;

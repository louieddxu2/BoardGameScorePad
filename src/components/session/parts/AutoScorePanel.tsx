
import React from 'react';
import { ScoreColumn, Player, ScoreValue } from '../../../types';
import { calculateColumnScore } from '../../../utils/scoring';
import { Calculator, ArrowRight, Variable, Sigma } from 'lucide-react';

interface AutoScorePanelProps {
  column: ScoreColumn;
  player: Player;
  allColumns: ScoreColumn[];
}

const AutoScorePanel: React.FC<AutoScorePanelProps> = ({ column, player, allColumns }) => {
  const variableMap: Record<string, { id: string; name: string }> = column.variableMap || {};
  const variables = Object.entries(variableMap);

  // 計算最終結果
  const context = { allColumns, playerScores: player.scores };
  const finalScore = calculateColumnScore(column, [], context);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-text p-2">
      {/* Header Info */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-2 shrink-0">
        <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg">
          <Calculator size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase font-bold text-slate-500">自動計算公式</div>
          <div className="text-sm font-mono text-white font-bold truncate tracking-wide">
            {column.formula}
          </div>
        </div>
        <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">結果</div>
            <div className="text-xl font-bold text-emerald-400">{finalScore}</div>
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
        {variables.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic">
                此公式沒有使用任何變數
            </div>
        ) : (
            <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 pl-1 mb-1 flex items-center gap-1">
                    <Variable size={10} /> 變數詳情
                </div>
                {variables.map(([varName, targetRef]) => {
                    const targetCol = allColumns.find(c => c.id === targetRef.id);
                    let value = 0;
                    let notFound = false;

                    if (targetCol) {
                        const scoreData = player.scores[targetCol.id];
                        const parts = scoreData?.parts || [];
                        // 遞迴計算該變數欄位的當前分數
                        value = calculateColumnScore(targetCol, parts, context);
                    } else {
                        notFound = true;
                    }

                    return (
                        <div key={varName} className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded font-mono font-bold text-indigo-300 text-sm border border-slate-700">
                                {varName}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-xs text-slate-400 truncate">
                                    {targetRef.name}
                                </span>
                                {notFound && <span className="text-[10px] text-red-400">找不到欄位</span>}
                            </div>
                            <ArrowRight size={14} className="text-slate-600 shrink-0" />
                            <div className="bg-slate-900 px-3 py-1 rounded text-white font-mono font-bold text-sm min-w-[3rem] text-center border border-slate-700">
                                {value}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
      
      {/* Footer Hint */}
      <div className="shrink-0 pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
          <Sigma size={10} />
          數值將自動隨其他欄位更新而變化
      </div>
    </div>
  );
};

export default AutoScorePanel;

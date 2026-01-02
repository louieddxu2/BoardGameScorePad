import React from 'react';
import { ScoreColumn, Player } from '../../../types';
import { calculateColumnScore } from '../../../utils/scoring';
import { getScoreRank, getPlayerRank, getTieCount } from '../../../utils/ranking';
import { Calculator, ArrowRight, Variable, Sigma, Users } from 'lucide-react';

interface AutoScorePanelProps {
  column: ScoreColumn;
  player: Player;
  allColumns: ScoreColumn[];
  allPlayers?: Player[]; // Added to support ranking calculation
}

const AutoScorePanel: React.FC<AutoScorePanelProps> = ({ column, player, allColumns, allPlayers }) => {
  // Explicitly type variableMap to fix TS errors
  const variableMap = (column.variableMap || {}) as Record<string, { 
    id: string; 
    name: string; 
    mode?: 'value' | 'rank_score' | 'rank_player' | 'tie_count';
  }>;
  const variables = Object.entries(variableMap);

  // Context for calculating the FINAL score of this auto column
  const context = { allColumns, playerScores: player.scores, allPlayers };
  const finalScore = calculateColumnScore(column, [], context);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-300 select-text p-[6px]">
      {/* Header Info - Use a more robust grid layout: auto for ends, 1fr for the flexible middle */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-[8px] pb-[6px] border-b border-slate-800 mb-[6px] shrink-0">
        
        {/* Icon - Sizes to its content */}
        <div className="p-[8px] bg-indigo-900/30 text-indigo-400 rounded-[8px] shrink-0 flex items-center justify-center">
          <Calculator size="1.125em" />
        </div>
        
        {/* Formula - Fills remaining space */}
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-bold text-slate-500">自動計算公式</div>
          <div className="overflow-x-auto no-scrollbar bg-black/20 rounded-[4px] py-[4px] border border-slate-700">
            <div className="text-sm font-mono text-white font-bold whitespace-nowrap tracking-wide px-[8px]">
              {column.formula}
            </div>
          </div>
        </div>
        
        {/* Result - Sizes to its content */}
        <div className="text-right shrink-0">
            <div className="text-[10px] uppercase font-bold text-slate-500">結果</div>
            <div className="text-xl font-bold text-emerald-400">{finalScore}</div>
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-[6px]">
        {variables.length === 0 ? (
            <div className="text-center py-[32px] text-slate-500 text-xs italic">
                此公式沒有使用任何變數
            </div>
        ) : (
            <div className="space-y-[4px]">
                <div className="text-[10px] uppercase font-bold text-slate-500 pl-[4px] mb-[4px] flex items-center gap-[4px]">
                    <Variable size="1em" /> 變數詳情
                </div>
                {variables.map(([varName, targetRef]) => {
                    let value = 0;
                    let notFound = false;
                    let isPlayerCount = false;

                    if (targetRef.id === '__PLAYER_COUNT__') {
                        value = allPlayers ? allPlayers.length : 0;
                        isPlayerCount = true;
                    } else {
                        const targetCol = allColumns.find(c => c.id === targetRef.id);
                        if (targetCol) {
                            const scoreData = player.scores[targetCol.id];
                            const parts = scoreData?.parts || [];
                            
                            // 1. 先計算當前玩家在該目標欄位的基礎數值
                            value = calculateColumnScore(targetCol, parts, context);

                            // 2. 如果變數設定為「排名模式」，則需進一步將上述數值轉換為排名
                            if (targetRef.mode && targetRef.mode !== 'value') {
                                if (allPlayers && allPlayers.length > 0) {
                                    // 計算所有玩家在該目標欄位的數值，形成評比池
                                    const allValues = allPlayers.map(p => {
                                        const pScoreValue = p.scores[targetCol.id];
                                        const pParts = pScoreValue?.parts || [];
                                        return calculateColumnScore(targetCol, pParts, {
                                            allColumns,
                                            playerScores: p.scores,
                                            allPlayers,
                                            depth: 0 
                                        });
                                    });

                                    if (targetRef.mode === 'rank_score') {
                                        value = getScoreRank(value, allValues);
                                    } else if (targetRef.mode === 'rank_player') {
                                        value = getPlayerRank(value, allValues);
                                    } else if (targetRef.mode === 'tie_count') {
                                        value = getTieCount(value, allValues);
                                    }
                                } else {
                                    // 若無玩家資料 (預覽時)，排名預設為 1
                                    value = 1;
                                }
                            }
                        } else {
                            notFound = true;
                        }
                    }

                    return (
                        <div key={varName} className="flex items-center gap-[12px] bg-slate-800/50 p-[8px] rounded-[8px] border border-slate-700/50">
                            <div className="w-[32px] h-[32px] flex items-center justify-center bg-slate-800 rounded-[4px] font-mono font-bold text-indigo-300 text-sm border border-slate-700">
                                {varName}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className={`text-xs truncate ${isPlayerCount ? 'text-indigo-300 font-bold' : 'text-slate-400'}`}>
                                    {isPlayerCount ? '👥 玩家人數' : targetRef.name}
                                </span>
                                {notFound && <span className="text-[10px] text-red-400">找不到欄位</span>}
                                {targetRef.mode && targetRef.mode !== 'value' && !isPlayerCount && (
                                    <span className="text-[9px] text-amber-500/70">
                                        ({targetRef.mode === 'rank_score' ? '分數排名' : targetRef.mode === 'rank_player' ? '玩家排名' : '平手數'})
                                    </span>
                                )}
                            </div>
                            <ArrowRight size="0.875em" className="text-slate-600 shrink-0" />
                            <div className="bg-slate-900 px-[12px] py-[4px] rounded-[4px] text-white font-mono font-bold text-sm w-[48px] text-center border border-slate-700">
                                {value}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
      
      {/* Footer Hint */}
      <div className="shrink-0 pt-[6px] border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-center gap-[4px]">
          <Sigma size="1em" />
          數值將自動隨其他欄位更新而變化
      </div>
    </div>
  );
};

export default AutoScorePanel;
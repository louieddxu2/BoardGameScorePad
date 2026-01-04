
import React, { useState, useEffect } from 'react';
import { GameTemplate, GameSession, ScoringRule } from '../../../types';
import { X, History, Play, Minus, Plus, Clock, Trophy, ChevronDown } from 'lucide-react';

interface GameSetupModalProps {
  template: GameTemplate;
  previewSession: GameSession | null;
  sessionPlayerCount?: number | null;
  onClose: () => void;
  onStart: (playerCount: number, options: { startTimeStr: string, scoringRule: ScoringRule }) => void;
  onResume: () => void;
}

const SCORING_OPTIONS: { value: ScoringRule, label: string }[] = [
    { value: 'HIGHEST_WINS', label: '競爭：最高分贏' },
    { value: 'LOWEST_WINS', label: '競爭：最低分贏' },
    { value: 'COOP', label: '合作' },
    { value: 'COMPETITIVE_NO_SCORE', label: '競爭(不計勝負)' },
    { value: 'COOP_NO_SCORE', label: '合作(不計勝負)' },
];

const GameSetupModal: React.FC<GameSetupModalProps> = ({ 
  template, 
  previewSession, 
  sessionPlayerCount,
  onClose, 
  onStart, 
  onResume 
}) => {
  
  const getInitialCount = () => {
    // 1. Priority: Current session memory (if user just went back)
    if (sessionPlayerCount) return sessionPlayerCount;
    
    // 2. Priority: Template Data (Now merged with DB preferences in useAppData)
    if (template.lastPlayerCount) return template.lastPlayerCount;
    
    return 4;
  };

  const [playerCount, setPlayerCount] = useState(getInitialCount);
  
  // Options State
  const [startTimeStr, setStartTimeStr] = useState('');
  
  const [scoringRule, setScoringRule] = useState<ScoringRule>(() => {
      // Template object already contains the merged preference
      return template.defaultScoringRule || 'HIGHEST_WINS';
  });

  // Initialize time on mount
  useEffect(() => {
      const now = new Date();
      // Format to HH:MM
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setStartTimeStr(`${hours}:${minutes}`);
  }, []);

  const handleStartClick = () => {
    onStart(playerCount, { startTimeStr, scoringRule });
  };

  // Helper to force open picker
  const handleTimeClick = (e: React.MouseEvent<HTMLInputElement>) => {
      try {
          if ('showPicker' in HTMLInputElement.prototype) {
              e.currentTarget.showPicker();
          }
      } catch (error) {
          // Fallback or ignore if not supported
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-slate-900 w-[95vw] max-w-sm rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex-none p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-base font-bold text-white truncate pr-2">{template.name}</h3>
                <button onClick={onClose} className="text-slate-500 hover:text-white shrink-0"><X size={20} /></button>
            </div>

            <div className="flex-1">
                {previewSession ? (
                    // Scenario A: Resume Available - Grid Layout (2x2 ish)
                    <div className="grid grid-cols-3 grid-rows-[auto_auto_1fr] h-auto max-h-[70vh]">
                        
                        {/* Top Left: Info (2/3) - Reduced Height */}
                        <div className="col-span-2 row-span-1 p-3 border-r border-b border-slate-700 bg-slate-800/20 overflow-y-auto no-scrollbar h-36 sm:h-40">
                            <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                                <History size={12} className="text-emerald-500"/>
                                <span>
                                    上次：{new Date(previewSession.startTime).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                {previewSession.players.slice(0, 4).map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-300 truncate max-w-[60%]">{p.name}</span>
                                        <span className="font-mono font-bold text-emerald-400">{p.totalScore}</span>
                                    </div>
                                ))}
                            </div>
                            {previewSession.players.length > 4 && <div className="text-[10px] text-slate-500 mt-1 italic">...共 {previewSession.players.length} 人</div>}
                        </div>

                        {/* Top Right: Resume Button (1/3) */}
                        <div className="col-span-1 row-span-1 border-b border-slate-700 bg-slate-800/20 p-1">
                            <button 
                                onClick={onResume} 
                                className="w-full h-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg flex flex-col items-center justify-center gap-1 shadow-inner active:scale-95 transition-all"
                            >
                                <Play size={24} fill="currentColor" />
                                <span className="text-sm font-bold leading-tight">繼續<br/>遊戲</span>
                            </button>
                        </div>

                        {/* Divider Header */}
                        <div className="col-span-3 row-span-1 bg-slate-900 border-b border-slate-700/50 py-1 px-3 flex items-center gap-2">
                            <div className="h-px bg-slate-700 flex-1"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">或是 開始新遊戲</span>
                            <div className="h-px bg-slate-700 flex-1"></div>
                        </div>

                        {/* Bottom Left: Setup (2/3) */}
                        <div className="col-span-2 row-span-1 p-3 border-r border-slate-700 flex flex-col justify-center items-center gap-3">
                            {/* Options Row (2/3 Time, 1/3 Rule) */}
                            <div className="flex gap-2 w-full">
                                <div className="flex-[2] bg-slate-800 rounded-lg p-1.5 border border-slate-700 flex items-center justify-center relative min-w-0">
                                    <input 
                                        type="time" 
                                        value={startTimeStr}
                                        onClick={handleTimeClick}
                                        onChange={(e) => setStartTimeStr(e.target.value)}
                                        className="bg-transparent text-white font-mono font-bold text-sm outline-none w-full text-center cursor-pointer p-0 border-none"
                                    />
                                </div>
                                <div className="flex-1 bg-slate-800 rounded-lg p-1.5 border border-slate-700 flex items-center relative min-w-0" title="勝利條件">
                                    <select 
                                        value={scoringRule}
                                        onChange={(e) => setScoringRule(e.target.value as ScoringRule)}
                                        className="bg-transparent text-white text-xs font-bold outline-none w-full appearance-none relative z-10 cursor-pointer pl-1 pr-3 py-0"
                                    >
                                        {SCORING_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value} className="bg-slate-800 text-slate-200">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-0.5 text-slate-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* Player Count */}
                            <div className="flex items-center justify-center gap-3 w-full">
                                <button 
                                    disabled={playerCount <= 1}
                                    onClick={() => setPlayerCount(c => Math.max(1, c - 1))} 
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg border ${playerCount <= 1 ? 'opacity-20 cursor-not-allowed bg-slate-800 border-slate-700' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'}`}
                                >
                                    <Minus size={20} strokeWidth={3} />
                                </button>
                                
                                <div className="min-w-[2rem] flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black font-mono text-white leading-none tracking-tighter drop-shadow-lg">{playerCount}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">玩家</span>
                                </div>
                                
                                <button 
                                    disabled={playerCount >= 12}
                                    onClick={() => setPlayerCount(c => Math.min(12, c + 1))} 
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg border ${playerCount >= 12 ? 'opacity-20 cursor-not-allowed bg-slate-800 border-slate-700' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                                >
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </div>

                        {/* Bottom Right: New Game Button (1/3) */}
                        <div className="col-span-1 row-span-1 p-2 flex flex-col items-center justify-center bg-slate-900/50 gap-2">
                            <span className="text-sm font-black text-rose-400 leading-none tracking-tight">重置記錄</span>
                            <span className="text-[10px] text-slate-500 leading-none">並</span>
                            <button 
                                onClick={handleStartClick} 
                                className="w-full flex-1 max-h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center"
                            >
                                <span className="text-xs font-bold leading-tight text-center">開始新遊戲</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Scenario B: No Resume - Simple Layout
                    <div className="p-6 flex flex-col items-center gap-6">
                        
                        {/* Options Row - Stacked layout for more width */}
                        <div className="grid grid-cols-2 gap-3 w-full px-1">
                            {/* Time */}
                            <div className="flex flex-col gap-1.5">
                                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 pl-1">
                                    <Clock size={12} /> 遊戲開始時間
                                </div>
                                <div className="bg-slate-800 rounded-lg border border-slate-700 px-2 py-2.5 w-full flex items-center justify-center hover:border-slate-600 cursor-pointer">
                                    <input 
                                        type="time" 
                                        value={startTimeStr}
                                        onClick={handleTimeClick}
                                        onChange={(e) => setStartTimeStr(e.target.value)}
                                        className="bg-transparent text-white font-mono font-bold text-sm outline-none w-full text-center cursor-pointer p-0 border-none appearance-none"
                                    />
                                </div>
                            </div>

                            {/* Rule */}
                            <div className="flex flex-col gap-1.5">
                                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 pl-1">
                                    <Trophy size={12} /> 勝利條件
                                </div>
                                <div className="bg-slate-800 rounded-lg border border-slate-700 px-2 py-2.5 w-full flex items-center relative hover:border-slate-600">
                                    <select 
                                        value={scoringRule}
                                        onChange={(e) => setScoringRule(e.target.value as ScoringRule)}
                                        className="bg-transparent text-white text-xs font-bold outline-none w-full appearance-none relative z-10 cursor-pointer pr-4"
                                    >
                                        {SCORING_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value} className="bg-slate-800 text-slate-200">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Player Count */}
                        <div className="w-full max-w-[200px] flex flex-col items-center gap-2">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">玩家人數</span>
                            <div className="flex items-center justify-between w-full bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-inner">
                                <button 
                                    disabled={playerCount <= 1}
                                    onClick={() => setPlayerCount(c => Math.max(1, c - 1))} 
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${playerCount <= 1 ? 'opacity-20 cursor-not-allowed' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
                                >
                                    <Minus size={20} />
                                </button>
                                <span className="text-3xl font-black font-mono text-white leading-none">{playerCount}</span>
                                <button 
                                    disabled={playerCount >= 12}
                                    onClick={() => setPlayerCount(c => Math.min(12, c + 1))} 
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${playerCount >= 12 ? 'opacity-20 cursor-not-allowed' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleStartClick} 
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 active:scale-95 transition-all"
                        >
                            <Play size={20} fill="currentColor" /> 開始計分
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default GameSetupModal;

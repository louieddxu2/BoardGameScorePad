
import React, { useState, useEffect, useMemo } from 'react';
import { GameTemplate, GameSession, ScoringRule } from '../../../types';
import { X, History, Play, Minus, Plus, Clock, Trophy, ChevronDown, Check } from 'lucide-react';
import { useGameFlowTranslation } from '../../../i18n/game_flow'; // Changed Import

interface GameSetupModalProps {
  template: GameTemplate;
  previewSession: GameSession | null;
  sessionPlayerCount?: number | null;
  onClose: () => void;
  onStart: (playerCount: number, options: { startTimeStr: string, scoringRule: ScoringRule }) => void;
  onResume: () => void;
}

const GameSetupModal: React.FC<GameSetupModalProps> = ({ 
  template, 
  previewSession, 
  sessionPlayerCount,
  onClose, 
  onStart, 
  onResume 
}) => {
  const { t, language } = useGameFlowTranslation(); // Use new hook

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

  // [New] Custom Dropdown State
  const [showRuleMenu, setShowRuleMenu] = useState(false);

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

  // Memoize options to react to language changes
  const scoringOptions = useMemo(() => [
      { value: 'HIGHEST_WINS', label: t('rule_highest') },
      { value: 'LOWEST_WINS', label: t('rule_lowest') },
      { value: 'COOP', label: t('rule_coop') },
      { value: 'COMPETITIVE_NO_SCORE', label: t('rule_comp_no_score') },
      { value: 'COOP_NO_SCORE', label: t('rule_coop_no_score') },
  ], [t]);

  const currentRuleLabel = scoringOptions.find(opt => opt.value === scoringRule)?.label || '';

  // Reverse options for upward menu so the first item (default) is at the bottom (closest to finger)
  const reversedOptions = [...scoringOptions].reverse();

  return (
    <>
    {/* Removed global backdrop div to avoid z-index stacking context issues */}
    
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
        {/* Main Card Container */}
        {/* We handle menu closing here by catching clicks on the card background */}
        <div 
            className="bg-slate-900 w-[95vw] max-w-sm rounded-2xl shadow-2xl border border-slate-800 flex flex-col" 
            onClick={(e) => { 
                e.stopPropagation(); 
                setShowRuleMenu(false); 
            }}
        >
            
            {/* Header: Added rounded-t-2xl explicitly */}
            <div className="flex-none px-2 py-1.5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                <h3 className="text-base font-bold text-white truncate pr-2 pl-1">{template.name}</h3>
                <button onClick={onClose} className="text-slate-500 hover:text-white shrink-0 p-1"><X size={20} /></button>
            </div>

            <div className="flex-1">
                {previewSession ? (
                    // Scenario A: Resume Available - Grid Layout (2x2 ish)
                    <div className="grid grid-cols-3 grid-rows-[auto_auto_1fr] h-auto max-h-[70vh]">
                        
                        {/* Top Left: Info (2/3) */}
                        <div className="col-span-2 row-span-1 p-1.5 border-r border-b border-slate-700 bg-slate-800/20 overflow-y-auto no-scrollbar h-32 sm:h-36">
                            <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                                <History size={12} className="text-emerald-500"/>
                                <span>
                                    {t('setup_last_played')} {new Date(previewSession.startTime).toLocaleString(language === 'en' ? 'en-US' : 'zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                            {previewSession.players.length > 4 && <div className="text-[10px] text-slate-500 mt-1 italic">{t('setup_more_players', { count: previewSession.players.length })}</div>}
                        </div>

                        {/* Top Right: Resume Button (1/3) */}
                        <div className="col-span-1 row-span-1 border-b border-slate-700 bg-slate-800/20 p-0.5">
                            <button 
                                onClick={onResume} 
                                className="w-full h-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg flex flex-col items-center justify-center gap-1 shadow-inner active:scale-95 transition-all"
                            >
                                <Play size={24} fill="currentColor" />
                                <span className="text-sm font-bold leading-tight whitespace-pre-line text-center">{t('setup_resume_btn')}</span>
                            </button>
                        </div>

                        {/* Divider Header */}
                        <div className="col-span-3 row-span-1 bg-slate-900 border-b border-slate-700/50 py-0.5 px-3 flex items-center gap-2">
                            <div className="h-px bg-slate-700 flex-1"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('setup_or_new')}</span>
                            <div className="h-px bg-slate-700 flex-1"></div>
                        </div>

                        {/* Bottom Left: Setup (2/3) - Added rounded-bl-2xl */}
                        <div className="col-span-2 row-span-1 p-1.5 border-r border-slate-700 flex flex-col justify-center items-center gap-1.5 overflow-visible rounded-bl-2xl">
                            {/* Options Row (2/3 Time, 1/3 Rule) - Reduced inner padding p-1 -> p-0.5 */}
                            <div className="flex gap-2 w-full relative z-20">
                                {/* [Changed] flex-[2] -> flex-1 for 50/50 width distribution */}
                                <div className="flex-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 flex items-center justify-center relative min-w-0">
                                    <input 
                                        type="time" 
                                        value={startTimeStr}
                                        onClick={handleTimeClick}
                                        onChange={(e) => setStartTimeStr(e.target.value)}
                                        className="bg-transparent text-white font-mono font-bold text-sm outline-none w-full text-center cursor-pointer p-0 border-none"
                                    />
                                </div>
                                
                                {/* Custom Dropdown Trigger (Compact Mode) */}
                                <div className="flex-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 flex items-center relative min-w-0" title={t('setup_rule')}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowRuleMenu(!showRuleMenu); }}
                                        className="w-full flex items-center justify-between px-1 py-0.5 text-xs font-bold text-white hover:bg-slate-700/50 rounded transition-colors"
                                    >
                                        <span className="truncate">{currentRuleLabel}</span>
                                        <ChevronDown size={12} className="text-slate-500 shrink-0 ml-0.5" />
                                    </button>

                                    {/* Dropdown Menu (Opens Upwards) - Using reversedOptions */}
                                    {showRuleMenu && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-[70] overflow-hidden min-w-[140px] -right-4 animate-in fade-in zoom-in-95 duration-200">
                                            {reversedOptions.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); // Prevent closing immediately
                                                        setScoringRule(opt.value as any); 
                                                        setShowRuleMenu(false); 
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 text-xs font-bold border-b border-slate-700/50 last:border-0 hover:bg-slate-700 flex items-center justify-between ${scoringRule === opt.value ? 'text-emerald-400 bg-emerald-900/10' : 'text-slate-200'}`}
                                                >
                                                    {opt.label}
                                                    {scoringRule === opt.value && <Check size={12} />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Player Count - Reduced gap-3 -> gap-2 */}
                            <div className="flex items-center justify-center gap-2 w-full z-10">
                                <button 
                                    disabled={playerCount <= 1}
                                    onClick={() => setPlayerCount(c => Math.max(1, c - 1))} 
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg border ${playerCount <= 1 ? 'opacity-20 cursor-not-allowed bg-slate-800 border-slate-700' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'}`}
                                >
                                    <Minus size={20} strokeWidth={3} />
                                </button>
                                
                                <div className="min-w-[2rem] flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black font-mono text-white leading-none tracking-tighter drop-shadow-lg">{playerCount}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-bold">{t('player_unit')}</span>
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

                        {/* Bottom Right: New Game Button (1/3) - Added rounded-br-2xl */}
                        <div className="col-span-1 row-span-1 p-1.5 flex flex-col items-center justify-center bg-slate-900/50 gap-1.5 rounded-br-2xl">
                            <span className="text-sm font-black text-rose-400 leading-none tracking-tight">{t('setup_reset_record')}</span>
                            <span className="text-[10px] text-slate-500 leading-none">{t('setup_and')}</span>
                            <button 
                                onClick={handleStartClick} 
                                className="w-full flex-1 max-h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center"
                            >
                                <span className="text-xs font-bold leading-tight text-center">{t('setup_start_new_btn')}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Scenario B: No Resume - Simple Layout
                    // Added rounded-b-2xl to container
                    <div className="p-3 flex flex-col items-center gap-3 rounded-b-2xl">
                        
                        {/* Options Row - Stacked layout for more width - gap-3 -> gap-2 */}
                        <div className="grid grid-cols-2 gap-2 w-full px-1 z-20">
                            {/* Time */}
                            <div className="flex flex-col gap-1">
                                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 pl-1">
                                    <Clock size={12} /> {t('setup_time')}
                                </div>
                                {/* Reduced input padding py-1.5 -> py-1 */}
                                <div className="bg-slate-800 rounded-lg border border-slate-700 px-2 py-1 w-full flex items-center justify-center hover:border-slate-600 cursor-pointer h-[38px]">
                                    <input 
                                        type="time" 
                                        value={startTimeStr}
                                        onClick={handleTimeClick}
                                        onChange={(e) => setStartTimeStr(e.target.value)}
                                        className="bg-transparent text-white font-mono font-bold text-sm outline-none w-full text-center cursor-pointer p-0 border-none appearance-none"
                                    />
                                </div>
                            </div>

                            {/* Rule - Custom Dropdown */}
                            <div className="flex flex-col gap-1 relative">
                                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 pl-1">
                                    <Trophy size={12} /> {t('setup_rule')}
                                </div>
                                <div className="bg-slate-800 rounded-lg border border-slate-700 px-2 py-1 w-full flex items-center relative hover:border-slate-600 h-[38px]">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowRuleMenu(!showRuleMenu); }}
                                        className="w-full flex items-center justify-between text-left h-full"
                                    >
                                        <span className="text-white text-xs font-bold truncate">{currentRuleLabel}</span>
                                        <ChevronDown size={12} className="text-slate-500 pointer-events-none shrink-0" />
                                    </button>

                                    {/* Dropdown Menu (Opened UPWARDS for New Game Layout as well) - Using reversedOptions */}
                                    {showRuleMenu && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-[70] overflow-hidden min-w-[160px] -right-2 animate-in fade-in zoom-in-95 duration-200">
                                            {reversedOptions.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={(e) => { 
                                                        e.stopPropagation();
                                                        setScoringRule(opt.value as any); 
                                                        setShowRuleMenu(false); 
                                                    }}
                                                    className={`w-full text-left px-3 py-3 text-xs font-bold border-b border-slate-700/50 last:border-0 hover:bg-slate-700 flex items-center justify-between ${scoringRule === opt.value ? 'text-emerald-400 bg-emerald-900/10' : 'text-slate-200'}`}
                                                >
                                                    {opt.label}
                                                    {scoringRule === opt.value && <Check size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Player Count */}
                        <div className="w-full max-w-[200px] flex flex-col items-center gap-1 z-10">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('setup_players')}</span>
                            {/* Reduced padding p-1.5 -> p-1 */}
                            <div className="flex items-center justify-between w-full bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner">
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

                        {/* Reduced button padding py-2.5 -> py-2 */}
                        <button 
                            onClick={handleStartClick} 
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 active:scale-95 transition-all z-10"
                        >
                            <Play size={20} fill="currentColor" /> {t('setup_start_btn')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
    </>
  );
};

export default GameSetupModal;

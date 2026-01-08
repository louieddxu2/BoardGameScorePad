
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn, QuickAction, ScoreValue } from '../../../types';
import { useSessionState } from '../hooks/useSessionState';
import { useSessionEvents } from '../hooks/useSessionEvents';
import NumericKeypad from '../../shared/NumericKeypad';
import ScoreInfoPanel from './ScoreInfoPanel';
import QuickButtonPad from '../../shared/QuickButtonPad';
import PlayerEditor, { PlayerSettingsPanel } from './PlayerEditor';
import AutoScorePanel from './AutoScorePanel';
import InputPanelLayout from './InputPanelLayout';
import { Eraser, ArrowRight, ArrowDown, Edit, Plus, ArrowUpToLine, ListPlus, Calculator, Scale, X, Check } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { getScoreHistory, getRawValue } from '../../../utils/scoring';
import { useVisualViewportOffset } from '../../../hooks/useVisualViewportOffset';

interface InputPanelProps {
  sessionState: ReturnType<typeof useSessionState>;
  eventHandlers: ReturnType<typeof useSessionEvents>;
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  onUpdateSession: (session: GameSession) => void;
  onUpdatePlayerHistory: (name: string) => void;
}

const PanelHeader: React.FC<{
  player: Player;
  col?: ScoreColumn;
  isEditingPlayer: boolean;
  onClear: () => void;
  onDirectionToggle: () => void;
  direction: 'horizontal' | 'vertical';
  isTotalMode?: boolean; // New prop
}> = ({ player, col, isEditingPlayer, onClear, onDirectionToggle, direction, isTotalMode }) => {
    
  // Handle transparent color fallback
  const isTransparent = player.color === 'transparent';
  const displayColor = isTransparent ? '#e2e8f0' : player.color; // Slate 200 for text
  const bgColor = isTransparent ? '#1e293b' : `${player.color}20`; // Slate 800 for bg if transparent
  const borderColor = isTransparent ? '#334155' : `${player.color}40`; // Slate 700 for border

  // Auto columns cannot be cleared manually
  const isAuto = col?.inputType === 'auto';

  return (
      <div
        className="border-b h-10 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar shrink-0 transition-colors"
        style={{ backgroundColor: bgColor, borderColor: borderColor }}
      >
        {isEditingPlayer ? (
          <>
            <Edit size={12} className="shrink-0" style={{ color: displayColor }} />
            <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: displayColor }}>編輯玩家</span>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-sm font-bold truncate" style={{ color: displayColor, ...(isColorDark(displayColor) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
              {player.name}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-bold truncate" style={{ color: displayColor, ...(isColorDark(displayColor) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
              {player.name}
            </span>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: displayColor }}>
                {isTotalMode ? '總分修正' : col?.name}
            </span>
          </>
        )}
        <div className="flex-1"></div>
        {!isAuto && (
            <button 
                onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                onClick={onClear} 
                className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs border border-red-500/30 hover:bg-red-900/50 flex items-center gap-1 shrink-0"
            >
                <Eraser size={12} /> {isTotalMode ? '歸零' : '清除'}
            </button>
        )}
        {!isTotalMode && (
            <button
            onMouseDown={(e) => e.preventDefault()} // Keep focus on input
            onClick={onDirectionToggle}
            className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shrink-0 border border-slate-600"
            >
            <span className="text-emerald-400">下一項</span>
            <span className={`font-mono transition-colors ${direction === 'vertical' ? 'text-emerald-400' : 'text-slate-600'}`}>↓</span>
            <span className={`font-mono transition-colors ${direction === 'horizontal' ? 'text-emerald-400' : 'text-slate-600'}`}>→</span>
            </button>
        )}
      </div>
  );
};

// Sidebar for Total Mode
const TotalAdjustmentSidebar: React.FC<{
    player: Player;
    onUpdatePlayer: (updates: Partial<Player>) => void;
}> = ({ player, onUpdatePlayer }) => {
    return (
        <div className="flex flex-col h-full p-2 gap-2">
            <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center justify-center gap-1 shrink-0">
                勝負修正
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar pt-1">
                {/* Tie Breaker Toggle */}
                <button
                    onClick={() => onUpdatePlayer({ tieBreaker: !player.tieBreaker })}
                    className={`flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1
                        ${player.tieBreaker 
                            ? 'bg-indigo-900/30 border-indigo-500 text-indigo-200 shadow-lg' 
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }
                    `}
                >
                    <Scale size={24} className={player.tieBreaker ? "fill-current" : ""} />
                    <span className="font-bold text-[10px] leading-none">打破平手</span>
                </button>

                {/* Force Loss Toggle */}
                <button
                    onClick={() => onUpdatePlayer({ isForceLost: !player.isForceLost })}
                    className={`flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1
                        ${player.isForceLost
                            ? 'bg-red-900/30 border-red-500 text-red-200 shadow-lg' 
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }
                    `}
                >
                    <X size={24} className={player.isForceLost ? "stroke-[3px]" : ""} />
                    <span className="font-bold text-[10px] leading-none">強制落敗</span>
                </button>
            </div>
        </div>
    );
};


const InputPanel: React.FC<InputPanelProps> = (props) => {
  const { sessionState, eventHandlers, session, template, playerHistory, onUpdateSession, onUpdatePlayerHistory } = props;
  const { uiState, setUiState, panelHeight } = sessionState;
  const { editingCell, editingPlayerId, advanceDirection, overwriteMode, isInputFocused, previewValue } = uiState;

  const visualViewportOffset = useVisualViewportOffset();
  const [activeFactorIdx, setActiveFactorIdx] = useState<0 | 1>(0);
  
  // Guard Ref to prevent re-initialization of preview value on every render
  // This is the key fix for the input reset bug
  const currentEditingIdRef = useRef<string | null>(null);

  // Initialize preview value based on column type when cell changes
  useEffect(() => {
    setActiveFactorIdx(0);
    
    // Construct a unique key for the current cell
    const targetId = editingCell ? `${editingCell.playerId}-${editingCell.colId}` : null;
    
    // Only update preview if we actually switched to a DIFFERENT cell
    if (targetId !== currentEditingIdRef.current) {
        currentEditingIdRef.current = targetId;

        if (editingCell) {
            // Special init for Total Mode
            if (editingCell.colId === '__TOTAL__') {
                const player = session.players.find(p => p.id === editingCell.playerId);
                if (player) {
                    // Initialize preview with current bonus score (defaulting to 0)
                    // This ensures when you open the bubble, it shows "+5" instead of "0"
                    setPreview(player.bonusScore || 0);
                }
                return;
            }

            const col = template.columns.find((c: any) => c.id === editingCell.colId);
            // Product + Next logic initialization
            if (col && (col.formula || '').includes('+next') && col.formula.includes('×a2')) {
                setUiState((p: any) => {
                    return { ...p, previewValue: { factors: [0, 1] } };
                });
            } else {
                // For standard cells, we typically start with 0 (or empty)
                setPreview(0); 
            }
        }
    }
  }, [editingCell, template.columns, setUiState, session.players]);

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  const updateScore = (playerId: string, colId: string, value: any) => {
    // Need to use the LATEST session data from props when calling this
    const players = session.players.map((p: any) => {
        if (p.id !== playerId) return p;
        const newScores = { ...p.scores };
        const col = template.columns.find((c: any) => c.id === colId);

        if (value === undefined || value === null || !col) {
            delete newScores[colId];
        } else {
            let parts: number[] = [];
            if ((col.formula || '').includes('+next')) {
                parts = (value.history || []).map((s: string) => parseFloat(s)).filter((n: number) => !isNaN(n));
            } else if (col.formula === 'a1×a2') {
                parts = (value.factors || []).map((f: any) => parseFloat(String(f))).filter((n: number) => !isNaN(n));
            } else {
                const rawVal = (typeof value === 'object' && value.value !== undefined) ? value.value : value;
                const num = parseFloat(String(rawVal));
                if (!isNaN(num)) parts = [num];
            }
            
            const newScoreObj: ScoreValue = { parts };
            // Save optionId if provided (for Select List rendering)
            if (typeof value === 'object' && value.optionId) {
                newScoreObj.optionId = value.optionId;
            }
            newScores[colId] = newScoreObj;
        }
        return { ...p, scores: newScores };
    });
    onUpdateSession({ ...session, players: players });
  };

  const updatePlayerMeta = (playerId: string, updates: Partial<Player>) => {
      const players = session.players.map(p => p.id === playerId ? { ...p, ...updates } : p);
      onUpdateSession({ ...session, players });
  };

  const handleToggleStarter = (playerId: string) => {
      const targetPlayer = session.players.find(p => p.id === playerId);
      const isCurrentlyStarter = !!targetPlayer?.isStarter;
      
      const newPlayers = session.players.map(p => ({
          ...p,
          isStarter: p.id === playerId ? !isCurrentlyStarter : false
      }));
      onUpdateSession({ ...session, players: newPlayers });
  };

  const setPreview = (val: any) => {
      setUiState((p: any) => ({ ...p, previewValue: val }));
  };

  const handleDirectionToggle = () => {
    setUiState((p: any) => ({ ...p, advanceDirection: p.advanceDirection === 'horizontal' ? 'vertical' : 'horizontal' }));
  };

  const handleClear = () => {
    if (editingPlayerId) {
      setUiState((p: any) => ({ ...p, tempPlayerName: '' }));
      updatePlayerMeta(editingPlayerId, { name: '' });
    } else if (editingCell) {
      const player = session.players.find((p: any) => p.id === editingCell.playerId);
      
      if (editingCell.colId === '__TOTAL__') {
          if (player) {
              updatePlayerMeta(player.id, { bonusScore: 0 });
              setPreview(0);
              setUiState((p: any) => ({ ...p, overwriteMode: true }));
          }
          return;
      }

      const col = template.columns.find((c: any) => c.id === editingCell.colId);
      if (player && col && col.inputType !== 'auto') {
        if ((col.formula || '').includes('+next')) {
            if (col.formula.includes('×a2')) {
                setPreview({ factors: [0, 1] });
                setActiveFactorIdx(0);
            } else {
                setPreview(0);
            }
        }
        updateScore(player.id, col.id, undefined);
        setUiState((p: any) => ({ ...p, overwriteMode: true }));
      }
    }
  };
  
  let mainContentNode = null;
  let sidebarContentNode: React.ReactNode = null;
  let onNextAction = () => {};
  let nextButtonContent: React.ReactNode = undefined;
  
  let activePlayer: Player | undefined;
  let activeColumn: ScoreColumn | undefined;
  let isEditingPlayerName = false;
  let isTotalMode = false;

  if (editingPlayerId) {
    activePlayer = session.players.find((p: any) => p.id === editingPlayerId);
    isEditingPlayerName = true;
    
    if (activePlayer) {
        mainContentNode = (
            <PlayerEditor
              player={activePlayer} playerHistory={playerHistory} tempName={uiState.tempPlayerName}
              setTempName={(name) => setUiState((p: any) => ({ ...p, tempPlayerName: name }))}
              isInputFocused={uiState.isInputFocused} setIsInputFocused={(focused) => setUiState((p: any) => ({ ...p, isInputFocused: focused }))}
              onUpdatePlayerColor={(color) => onUpdateSession({ ...session, players: session.players.map((p: any) => p.id === editingPlayerId ? { ...p, color } : p) })}
              onNameSubmit={eventHandlers.handlePlayerNameSubmit}
              onToggleStarter={handleToggleStarter}
            />
        );
        sidebarContentNode = isInputFocused ? null : <PlayerSettingsPanel player={activePlayer} onToggleStarter={handleToggleStarter} />;
        onNextAction = () => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            eventHandlers.handlePlayerNameSubmit(activePlayer!.id, uiState.tempPlayerName, true);
        };
    }
  } else if (editingCell) {
    activePlayer = session.players.find((p: any) => p.id === editingCell.playerId);
    
    // --- SPECIAL MODE: TOTAL ADJUSTMENT ---
    if (editingCell.colId === '__TOTAL__') {
        isTotalMode = true;
        if (activePlayer) {
            // Re-use Dummy Column logic for Keypad
            const dummyCol: ScoreColumn = { 
                id: '__TOTAL__', 
                name: '總分修正', 
                formula: 'a1', 
                inputType: 'keypad', 
                isScoring: true, 
                rounding: 'none' 
            };
            
            // Keypad updates bonusScore directly
            mainContentNode = <NumericKeypad 
                value={{ value: previewValue }}
                onChange={(val: any) => {
                    // 1. Update raw preview string first to maintain UI state (e.g. "-0", "5.")
                    setPreview(val.value);
                    
                    // 2. Then parse and update actual session data if valid
                    const num = parseFloat(String(val.value));
                    if (!isNaN(num)) {
                        updatePlayerMeta(activePlayer!.id, { bonusScore: num });
                    }
                }}
                column={dummyCol} 
                overwrite={overwriteMode} 
                setOverwrite={(v: boolean) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                onNext={() => setUiState((p: any) => ({ ...p, editingCell: null }))} // Close on next
                activeFactorIdx={0} 
                setActiveFactorIdx={() => {}} 
                playerId={activePlayer.id}
            />;

            sidebarContentNode = <TotalAdjustmentSidebar player={activePlayer} onUpdatePlayer={(u) => updatePlayerMeta(activePlayer!.id, u)} />;
            
            nextButtonContent = <Check size={24} />;
            onNextAction = () => setUiState((p: any) => ({ ...p, editingCell: null }));
        }
    } 
    // --- STANDARD COLUMN MODE ---
    else {
        activeColumn = template.columns.find((c: any) => c.id === editingCell.colId);

        if (activeColumn && activePlayer) {
            const isProductMode = activeColumn.formula.includes('×a2');
            const isSumPartsMode = (activeColumn.formula || '').includes('+next');
            const isProductSumPartsMode = isSumPartsMode && isProductMode;
            const constant = activeColumn.constants?.c1 ?? 1;
            const hasMultiplier = constant !== 1;

            const cellScoreObject = activePlayer.scores[activeColumn.id];

            // Default next action
            onNextAction = () => {
                eventHandlers.moveToNext();
            };

            const handleDeleteLastPart = () => {
                if (!activePlayer || !activeColumn) return;
                const currentHistory = getScoreHistory(cellScoreObject);
                if (currentHistory.length > 0) {
                    const newHistory = currentHistory.slice(0, -1);
                    const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                    updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                }
            };

            const handleQuickButtonAction = (action: QuickAction) => {
                if (!activePlayer || !activeColumn) return;

                if (isProductSumPartsMode) {
                    let currentFactors = [0, 1];
                    if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                        currentFactors = previewValue.factors.slice();
                    }

                    if (activeFactorIdx === 0) { // Editing Factor A
                        currentFactors[0] = action.value;
                        setPreview({ factors: currentFactors });
                        setActiveFactorIdx(1);
                        setUiState((p: any) => ({ ...p, overwriteMode: true }));
                    } else { // Editing Factor B
                        const n1 = parseFloat(String(currentFactors[0])) || 0;
                        const n2 = action.value;
                        const product = n1 * n2;
                        
                        const currentHistory = getScoreHistory(cellScoreObject);
                        const newHistory = [...currentHistory, String(product)];
                        const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                        updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });

                        // Reset for next entry
                        setPreview({ factors: [0, 1] });
                        setActiveFactorIdx(0);
                        setUiState((p: any) => ({ ...p, overwriteMode: true }));
                    }
                } else if (isSumPartsMode) {
                    const currentHistory = getScoreHistory(cellScoreObject);
                    let newHistory = [...currentHistory];
                    // Apply multiplier immediately for sum parts
                    const valToAdd = hasMultiplier ? action.value * constant : action.value;

                    if (action.isModifier && newHistory.length > 0) {
                        newHistory[newHistory.length - 1] = String(parseFloat(newHistory[newHistory.length - 1]) + valToAdd);
                    } else {
                        newHistory.push(String(valToAdd));
                    }
                    const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                    updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                } else { // It's a select list, so it replaces the value and moves next
                    // Pass ID as well as value
                    updateScore(activePlayer.id, activeColumn.id, { value: action.value, optionId: action.id });
                    eventHandlers.moveToNext();
                }
            };

            if (activeColumn.inputType === 'auto') {
                // Auto Calculation View
                mainContentNode = (
                    <div className="h-full flex items-center justify-center bg-slate-900/50 rounded-xl border border-slate-700 p-4">
                        <AutoScorePanel 
                            column={activeColumn} 
                            player={activePlayer} 
                            allColumns={template.columns} 
                            allPlayers={session.players} 
                        />
                    </div>
                );
                sidebarContentNode = (
                    <div className="flex flex-col h-full p-2 text-slate-400 text-xs">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0">
                            <Calculator size={12} /> 自動計算
                        </div>
                        <div className="flex-1 overflow-y-auto pt-2 space-y-2">
                            <p>此欄位由公式自動產生結果。</p>
                            <p>您無需手動輸入數值。</p>
                        </div>
                    </div>
                );
            } else if (activeColumn.inputType === 'clicker') {
                // Clicker / Quick Actions
                mainContentNode = ( <QuickButtonPad column={activeColumn} onAction={handleQuickButtonAction} /> );
                
                if (isProductSumPartsMode) {
                    sidebarContentNode = <ScoreInfoPanel 
                        column={activeColumn} 
                        value={cellScoreObject} 
                        activeFactorIdx={activeFactorIdx} 
                        setActiveFactorIdx={setActiveFactorIdx}
                        localKeypadValue={previewValue} // Pass global preview
                        onDeleteLastPart={handleDeleteLastPart}
                        setOverwrite={(v) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                    />;
                } else if (isSumPartsMode) {
                    sidebarContentNode = <ScoreInfoPanel column={activeColumn} value={cellScoreObject} onDeleteLastPart={handleDeleteLastPart} />;
                } else {
                    sidebarContentNode = ( <div className="flex flex-col h-full p-2 text-slate-400 text-xs"><div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><ListPlus size={12} /> 列表選單</div><div className="flex-1"></div></div> );
                }
            } else { // 'keypad'
                // Keypad Logic
                if (isSumPartsMode) {
                    if (isProductSumPartsMode) {
                        // Product Sum Parts Logic (A x B then add)
                        let currentFactors = [0, 1];
                        if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                            currentFactors = previewValue.factors;
                        }
                        const n1 = parseFloat(String(currentFactors[0])) || 0;
                        
                        if (n1 !== 0) {
                            if (activeFactorIdx === 0) {
                                // If user is editing Factor A and it's non-zero, next button moves to Factor B
                                nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">輸入 {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
                                onNextAction = () => {
                                    setActiveFactorIdx(1);
                                    setUiState((p: any) => ({ ...p, overwriteMode: true }));
                                };
                            } else {
                                // If editing Factor B (or finished A), show Add button
                                nextButtonContent = <ArrowUpToLine size={28} />;
                                onNextAction = () => {
                                    const product = (parseFloat(String(currentFactors[0])) || 0) * (parseFloat(String(currentFactors[1])) || 0);
                                    if (product !== 0 || n1 !== 0) { 
                                        const currentHistory = getScoreHistory(cellScoreObject);
                                        const newHistory = [...currentHistory, String(product)];
                                        const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                                        updateScore(activePlayer!.id, activeColumn!.id, { value: newSum, history: newHistory });
                                        
                                        // Reset local state
                                        setPreview({ factors: [0, 1] });
                                        setActiveFactorIdx(0);
                                        setUiState((p: any) => ({ ...p, overwriteMode: true }));
                                    } else {
                                        eventHandlers.moveToNext();
                                    }
                                };
                            }
                        }
                    } else {
                        // Standard Sum Parts Logic
                        const inputPart = parseFloat(String(getRawValue(previewValue))) || 0;
                        if (inputPart !== 0) nextButtonContent = <ArrowUpToLine size={28} />;
                        
                        onNextAction = () => {
                            const input = parseFloat(String(getRawValue(previewValue))) || 0;
                            if (input !== 0) {
                                // Apply constant multiplier if exists
                                const valToAdd = hasMultiplier ? input * constant : input;
                                
                                const currentHistory = getScoreHistory(cellScoreObject);
                                const newHistory = [...currentHistory, String(valToAdd)];
                                const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                                updateScore(activePlayer!.id, activeColumn!.id, { value: newSum, history: newHistory });
                                setPreview(0);
                                setUiState((p: any) => ({ ...p, overwriteMode: true }));
                            } else {
                                eventHandlers.moveToNext();
                            }
                        };
                    }
                } else if (isProductMode) {
                    const n1 = parseFloat(String(cellScoreObject?.parts?.[0] ?? 0)) || 0;
                    if (n1 !== 0 && activeFactorIdx === 0) {
                        nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">輸入 {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
                        onNextAction = () => {
                            setActiveFactorIdx(1);
                            setUiState((p: any) => ({ ...p, overwriteMode: true }));
                        }
                    }
                }

                let keypadValue;
                if (isSumPartsMode) { keypadValue = previewValue; } 
                else if (isProductMode) { keypadValue = { factors: cellScoreObject?.parts ?? [0, 1] }; } 
                else { keypadValue = { value: cellScoreObject?.parts?.[0] ?? 0 }; }
                
                mainContentNode = <NumericKeypad 
                    value={keypadValue}
                    onChange={(val: any) => isSumPartsMode ? setPreview(val) : updateScore(activePlayer!.id, activeColumn!.id, val)}
                    column={activeColumn} overwrite={overwriteMode} setOverwrite={(v: boolean) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                    onNext={onNextAction} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx} playerId={activePlayer.id}
                />;
                sidebarContentNode = <ScoreInfoPanel 
                column={activeColumn} value={cellScoreObject} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx}
                localKeypadValue={isSumPartsMode ? previewValue : undefined} // Use global preview
                onDeleteLastPart={isSumPartsMode ? handleDeleteLastPart : undefined}
                setOverwrite={(v) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                />;
            }
        }
    }
  }

  // --- Auto-Commit on Blur Logic ---
  const commitRef = useRef({ previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode });
  useEffect(() => {
      commitRef.current = { previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode };
  });

  useEffect(() => {
      return () => {
          const { previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode } = commitRef.current;
          
          if (!activePlayer) return;
          
          if (isTotalMode) {
              // Total Mode updates player meta instantly via keypad onChange
              // No commit on blur needed to prevent overwriting with old state
              return;
          }

          if (!activeColumn) return;
          
          const isSumPartsMode = (activeColumn.formula || '').includes('+next');
          const isProductMode = activeColumn.formula.includes('×a2');
          
          // Auto-commit only for Sum Parts mode where user might leave uncommitted data
          if (isSumPartsMode) {
              const cellScoreObject = activePlayer.scores[activeColumn.id];
              const constant = activeColumn.constants?.c1 ?? 1;
              const hasMultiplier = constant !== 1;

              if (isProductMode) { // Product Sum Parts
                  let currentFactors = [0, 1];
                  if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                      currentFactors = previewValue.factors;
                  }
                  const n1 = parseFloat(String(currentFactors[0])) || 0;
                  const n2 = parseFloat(String(currentFactors[1])) || 0;
                  // Only commit if we have meaningful input (e.g. A!=0)
                  if (n1 !== 0) {
                      const product = n1 * n2;
                      const currentHistory = getScoreHistory(cellScoreObject);
                      const newHistory = [...currentHistory, String(product)];
                      const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                      updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                  }
              } else { // Standard Sum Parts
                  const input = parseFloat(String(getRawValue(previewValue))) || 0;
                  if (input !== 0) {
                      const valToAdd = hasMultiplier ? input * constant : input;
                      const currentHistory = getScoreHistory(cellScoreObject);
                      const newHistory = [...currentHistory, String(valToAdd)];
                      const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                      updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                  }
              }
          }
      };
  }, [editingCell?.playerId, editingCell?.colId]);

  return (
    <div
      className={`fixed left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-sm border-t border-slate-700/50 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all ease-in-out flex flex-col overflow-hidden ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'} ${isInputFocused ? 'duration-0' : 'duration-300'}`}
      style={{ height: panelHeight, bottom: visualViewportOffset }}
    >
      {activePlayer && (
        <PanelHeader 
            player={activePlayer} 
            col={activeColumn} 
            isEditingPlayer={isEditingPlayerName} 
            onClear={handleClear} 
            onDirectionToggle={handleDirectionToggle} 
            direction={advanceDirection}
            isTotalMode={isTotalMode}
        />
      )}
      <div className="flex-1 min-h-0 bg-slate-900">
        {mainContentNode && (
          <InputPanelLayout onNext={onNextAction} nextButtonDirection={advanceDirection} sidebarContent={sidebarContentNode} nextButtonContent={nextButtonContent} isCompact={isInputFocused}>
            {mainContentNode}
          </InputPanelLayout>
        )}
      </div>
    </div>
  );
};

export default InputPanel;

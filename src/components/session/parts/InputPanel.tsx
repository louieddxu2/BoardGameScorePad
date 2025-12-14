
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn, QuickAction } from '../../../types';
import { useSessionState } from '../hooks/useSessionState';
import { useSessionEvents } from '../hooks/useSessionEvents';
import { NumericKeypadContent, NumericKeypadInfo } from '../../shared/NumericKeypad';
import QuickButtonPad from '../../shared/QuickButtonPad';
import PlayerEditor, { PlayerEditorInfo } from './PlayerEditor';
import SelectOptionInput from './SelectOptionInput';
import InputPanelLayout from './InputPanelLayout';
import { Eraser, ArrowRight, ArrowDown, Edit, Plus, ArrowUpToLine, RotateCcw } from 'lucide-react';
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
}> = ({ player, col, isEditingPlayer, onClear, onDirectionToggle, direction }) => (
  <div
    className="border-b h-10 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar shrink-0 transition-colors"
    style={{ backgroundColor: `${player.color}20`, borderColor: `${player.color}40` }}
  >
    {isEditingPlayer ? (
      <>
        <Edit size={12} className="shrink-0" style={{ color: player.color }} />
        <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: player.color }}>編輯玩家</span>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <span className="text-sm font-bold truncate" style={{ color: player.color, ...(isColorDark(player.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
          {player.name}
        </span>
      </>
    ) : (
      <>
        <span className="text-sm font-bold truncate" style={{ color: player.color, ...(isColorDark(player.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
          {player.name}
        </span>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: player.color }}>{col?.name}</span>
      </>
    )}
    <div className="flex-1"></div>
    <button 
        onMouseDown={(e) => e.preventDefault()} // Keep focus on input
        onClick={onClear} 
        className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs border border-red-500/30 hover:bg-red-900/50 flex items-center gap-1 shrink-0"
    >
        <Eraser size={12} /> 清除
    </button>
    <button
      onMouseDown={(e) => e.preventDefault()} // Keep focus on input
      onClick={onDirectionToggle}
      className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 h-8 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shrink-0 border border-slate-600"
    >
      <span className="text-emerald-400">下一項</span>
      <span className={`font-mono transition-colors ${direction === 'vertical' ? 'text-emerald-400' : 'text-slate-600'}`}>↓</span>
      <span className={`font-mono transition-colors ${direction === 'horizontal' ? 'text-emerald-400' : 'text-slate-600'}`}>→</span>
    </button>
  </div>
);


const InputPanel: React.FC<InputPanelProps> = (props) => {
  const { sessionState, eventHandlers, session, template, playerHistory, onUpdateSession, onUpdatePlayerHistory } = props;
  const { uiState, setUiState, panelHeight } = sessionState;
  const { editingCell, editingPlayerId, advanceDirection, overwriteMode, isInputFocused } = uiState;

  // 使用我們新寫的 Hook 來偵測鍵盤偏移量
  const visualViewportOffset = useVisualViewportOffset();

  // Local state for keypad to decouple transient input from persisted score
  const [localKeypadValue, setLocalKeypadValue] = useState<any>(0);
  
  // Lifted state for product mode
  const [activeFactorIdx, setActiveFactorIdx] = useState<0 | 1>(0);

  useEffect(() => {
    setActiveFactorIdx(0); // Reset factor index when cell changes
    setLocalKeypadValue(0); // Reset temp keypad input
    setUiState(p => ({ ...p, overwriteMode: true })); // Reset to overwrite mode
  }, [editingCell]);


  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  const updateScore = (playerId: string, colId: string, value: any) => {
    const players = session.players.map(p =>
      p.id !== playerId ? p : { ...p, scores: { ...p.scores, [colId]: value } }
    );
    onUpdateSession({ ...session, players });
  };

  const handleDirectionToggle = () => {
    setUiState(p => ({
      ...p,
      advanceDirection: p.advanceDirection === 'horizontal' ? 'vertical' : 'horizontal'
    }));
  };

  const handleClear = () => {
    if (editingPlayerId) {
      setUiState(p => ({ ...p, tempPlayerName: '' }));
    } else if (editingCell) {
      const player = session.players.find(p => p.id === editingCell.playerId);
      const col = template.columns.find(c => c.id === editingCell.colId);
      if (player && col) {
        if (col.calculationType === 'sum-parts') {
            setLocalKeypadValue(0);
        }
        updateScore(player.id, col.id, undefined);
        setUiState(p => ({ ...p, overwriteMode: true }));
      }
    }
  };
  
  // --- Prepare Content ---
  let mainContentNode = null;
  let sidebarContentNode: React.ReactNode = null;
  let onNextAction = () => {};
  let nextButtonContent: React.ReactNode = undefined;
  
  let activePlayer: Player | undefined;
  let activeColumn: ScoreColumn | undefined;
  let isEditingPlayerName = false;

  if (editingPlayerId) {
    activePlayer = session.players.find(p => p.id === editingPlayerId);
    isEditingPlayerName = true;
    
    if (activePlayer) {
        mainContentNode = (
            <PlayerEditor
              player={activePlayer}
              playerHistory={playerHistory}
              tempName={uiState.tempPlayerName}
              setTempName={(name) => setUiState(p => ({ ...p, tempPlayerName: name }))}
              isInputFocused={uiState.isInputFocused}
              setIsInputFocused={(focused) => setUiState(p => ({ ...p, isInputFocused: focused }))}
              onUpdatePlayerColor={(color) => onUpdateSession({ ...session, players: session.players.map(p => p.id === editingPlayerId ? { ...p, color } : p) })}
              onNameSubmit={eventHandlers.handlePlayerNameSubmit}
            />
        );
        // HIDE Sidebar content when focused
        sidebarContentNode = isInputFocused ? null : <PlayerEditorInfo />;
        onNextAction = () => eventHandlers.handlePlayerNameSubmit(activePlayer!.id, uiState.tempPlayerName, true);
    }

  } else if (editingCell) {
    activeColumn = template.columns.find(c => c.id === editingCell.colId);
    activePlayer = session.players.find(p => p.id === editingCell.playerId);

    if (activeColumn && activePlayer) {
        const isProductMode = activeColumn.calculationType === 'product';
        const isSumPartsMode = activeColumn.calculationType === 'sum-parts';
        const cellScoreObject = activePlayer.scores[activeColumn.id];

        // Define Next Action based on mode
        onNextAction = () => {
            if (isSumPartsMode) {
                const newPartRaw = (typeof localKeypadValue === 'object') ? localKeypadValue.value : localKeypadValue;
                const newPart = parseFloat(String(newPartRaw)) || 0;

                if (newPart === 0) {
                    eventHandlers.moveToNext();
                } else {
                    const currentScore = cellScoreObject || { value: 0, history: [] };
                    const newHistory = [...(currentScore.history || []), String(newPart)];
                    const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                    updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                    setLocalKeypadValue(0);
                    setUiState(p => ({ ...p, overwriteMode: true }));
                }
            } else if (isProductMode && activeFactorIdx === 0) {
                 // Check if the first factor is 0. If so, skip the second factor.
                 const currentVal = activePlayer.scores[activeColumn.id];
                 const factors = (typeof currentVal === 'object' && currentVal?.factors) ? currentVal.factors : [0, 0];
                 const n1 = parseFloat(String(factors[0])) || 0;
                 
                 if (n1 === 0) {
                     eventHandlers.moveToNext();
                 } else {
                     setActiveFactorIdx(1);
                 }
            } else {
                eventHandlers.moveToNext();
            }
        };

        const handleDeleteLastPart = () => {
            if (!activePlayer || !activeColumn) return;
            const currentScore = activePlayer.scores[activeColumn.id];
            const currentHistory = getScoreHistory(currentScore);
            
            if (currentHistory.length > 0) {
                const newHistory = currentHistory.slice(0, -1);
                const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
            }
        };

        const handleQuickButtonAction = (action: QuickAction) => {
             if (!activePlayer || !activeColumn) return;
             const val = action.value;
             
             if (isSumPartsMode) {
                  // Sum Parts Mode
                  const currentScore = cellScoreObject || { value: 0, history: [] };
                  let newHistory = [...(currentScore.history || [])];

                  // Handle Modifier Logic: If modifier AND history exists, modify the last entry
                  if (action.isModifier && newHistory.length > 0) {
                       const lastVal = parseFloat(newHistory.pop() || '0');
                       const newVal = lastVal + val;
                       newHistory.push(String(newVal));
                  } else {
                       // Normal Append
                       newHistory.push(String(val));
                  }
                  
                  const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                  updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
             } else {
                  // Standard Accumulator Mode
                  const currentVal = getRawValue(cellScoreObject) || 0;
                  const newVal = currentVal + val;
                  const currentHistory = getScoreHistory(cellScoreObject);
                  
                  // For standard mode, maybe we just log it differently? 
                  // For now, standard mode usually just keeps a linear log.
                  // But if modifier, we can try to merge visually? 
                  // Keeping it simple for standard: Modifier acts like normal add but maybe we can denote it in history later.
                  // Current implementation: just add to list.
                  const newHistory = [...currentHistory, val > 0 ? `+${val}` : `${val}`];
                  
                  updateScore(activePlayer.id, activeColumn.id, { value: newVal, history: newHistory });
             }
        };

        // Determine button content dynamically
        if (isSumPartsMode && activeColumn.inputType !== 'clicker') { // Only show upload button for keypad mode
            const newPartRaw = (typeof localKeypadValue === 'object') ? localKeypadValue.value : localKeypadValue;
            const newPart = parseFloat(String(newPartRaw)) || 0;
            if (newPart !== 0) {
                nextButtonContent = <ArrowUpToLine size={28} />;
            }
        } else if (isProductMode && activeFactorIdx === 0) {
             const currentVal = activePlayer.scores[activeColumn.id];
             const factors = (typeof currentVal === 'object' && currentVal?.factors) ? currentVal.factors : [0, 0];
             const n1 = parseFloat(String(factors[0])) || 0;
             if (n1 !== 0) {
                 nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">輸入 {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
             }
        }

        if (activeColumn.type === 'number') {
            const hasMappingRules = activeColumn.mappingRules && activeColumn.mappingRules.length > 0;
            // 關鍵修改：如果是乘積模式，強制不使用 Clicker (即使 inputType 是 clicker)
            const useClicker = !isProductMode && activeColumn.inputType === 'clicker' && !hasMappingRules;

            if (useClicker) {
                 // Use the new QuickButtonPad
                 mainContentNode = (
                    <QuickButtonPad column={activeColumn} onAction={handleQuickButtonAction} />
                 );
                 sidebarContentNode = <NumericKeypadInfo 
                    column={activeColumn} 
                    value={cellScoreObject}
                    localKeypadValue={undefined}
                    onDeleteLastPart={handleDeleteLastPart} // Works for both standard history and sum parts
                 />;
            } else {
                // Use Standard Keypad
                const keypadProps = {
                    value: isSumPartsMode ? localKeypadValue : cellScoreObject,
                    onChange: (val: any) => {
                        if (isSumPartsMode) {
                          setLocalKeypadValue(val);
                        } else {
                          updateScore(activePlayer!.id, activeColumn!.id, val)
                        }
                    },
                    column: activeColumn,
                    overwrite: overwriteMode,
                    setOverwrite: (v: boolean) => setUiState(p => ({ ...p, overwriteMode: v })),
                    onNext: onNextAction,
                    activeFactorIdx: activeFactorIdx,
                    setActiveFactorIdx: setActiveFactorIdx,
                    playerId: activePlayer.id,
                };
                mainContentNode = <NumericKeypadContent {...keypadProps} />;
                sidebarContentNode = <NumericKeypadInfo 
                  column={activeColumn} 
                  value={cellScoreObject} 
                  activeFactorIdx={activeFactorIdx}
                  setActiveFactorIdx={setActiveFactorIdx} // 傳遞切換函式
                  localKeypadValue={isSumPartsMode ? localKeypadValue : undefined}
                  onDeleteLastPart={isSumPartsMode ? handleDeleteLastPart : undefined}
                />;
            }
        
        } else if (activeColumn.type === 'select' || activeColumn.type === 'boolean') {
            mainContentNode = (
              <SelectOptionInput
                column={activeColumn}
                currentValue={cellScoreObject}
                onSelect={(value) => { updateScore(activePlayer!.id, activeColumn!.id, value); eventHandlers.moveToNext(); }}
              />
            );
        }
    }
  }

  return (
    <div
      className={`fixed left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-sm border-t border-slate-700/50 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all ease-in-out flex flex-col overflow-hidden ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'} ${isInputFocused ? 'duration-0' : 'duration-300'}`}
      style={{ 
          height: panelHeight,
          // 關鍵修改：將偏移量加到 bottom 屬性
          // 當系統鍵盤彈出時 (visualViewportOffset > 0)，整個面板會被抬高
          bottom: visualViewportOffset 
      }}
    >
      {activePlayer && (
        <PanelHeader
          player={activePlayer}
          col={activeColumn}
          isEditingPlayer={isEditingPlayerName}
          onClear={handleClear}
          onDirectionToggle={handleDirectionToggle}
          direction={advanceDirection}
        />
      )}
      <div className="flex-1 min-h-0 bg-slate-900">
        {mainContentNode && (
          <InputPanelLayout
            onNext={onNextAction}
            nextButtonDirection={advanceDirection}
            sidebarContent={sidebarContentNode}
            nextButtonContent={nextButtonContent}
            isCompact={isInputFocused} // Enable compact mode when focused
          >
            {mainContentNode}
          </InputPanelLayout>
        )}
      </div>
    </div>
  );
};

export default InputPanel;

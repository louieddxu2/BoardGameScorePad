
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn, QuickAction, ScoreValue } from '../../../types';
import { useSessionState } from '../hooks/useSessionState';
import { useSessionEvents } from '../hooks/useSessionEvents';
import { NumericKeypadContent, NumericKeypadInfo } from '../../shared/NumericKeypad';
import QuickButtonPad from '../../shared/QuickButtonPad';
import PlayerEditor, { PlayerEditorInfo } from './PlayerEditor';
import InputPanelLayout from './InputPanelLayout';
import { Eraser, ArrowRight, ArrowDown, Edit, Plus, ArrowUpToLine, ListPlus } from 'lucide-react';
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
        // Use onClear prop instead of undefined handleClear
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

  const visualViewportOffset = useVisualViewportOffset();
  const [localKeypadValue, setLocalKeypadValue] = useState<any>(0);
  const [activeFactorIdx, setActiveFactorIdx] = useState<0 | 1>(0);

  useEffect(() => {
    setActiveFactorIdx(0);
    setLocalKeypadValue(0);
    setUiState((p: any) => ({ ...p, overwriteMode: true }));
  }, [editingCell, setUiState]);

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  const updateScore = (playerId: string, colId: string, value: any) => {
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
            newScores[colId] = { parts };
        }
        return { ...p, scores: newScores };
    });
    onUpdateSession({ ...session, players: players });
  };

  const handleDirectionToggle = () => {
    setUiState((p: any) => ({ ...p, advanceDirection: p.advanceDirection === 'horizontal' ? 'vertical' : 'horizontal' }));
  };

  const handleClear = () => {
    if (editingPlayerId) {
      setUiState((p: any) => ({ ...p, tempPlayerName: '' }));
    } else if (editingCell) {
      const player = session.players.find((p: any) => p.id === editingCell.playerId);
      const col = template.columns.find((c: any) => c.id === editingCell.colId);
      if (player && col) {
        if ((col.formula || '').includes('+next')) {
            setLocalKeypadValue(0);
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
            />
        );
        sidebarContentNode = isInputFocused ? null : <PlayerEditorInfo />;
        onNextAction = () => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            eventHandlers.handlePlayerNameSubmit(activePlayer!.id, uiState.tempPlayerName, true);
        };
    }
  } else if (editingCell) {
    activeColumn = template.columns.find((c: any) => c.id === editingCell.colId);
    activePlayer = session.players.find((p: any) => p.id === editingCell.playerId);

    if (activeColumn && activePlayer) {
        const isProductMode = activeColumn.formula === 'a1×a2';
        const isSumPartsMode = (activeColumn.formula || '').includes('+next');
        const cellScoreObject = activePlayer.scores[activeColumn.id];

        onNextAction = () => {
            if (isSumPartsMode && activeColumn.inputType === 'keypad') {
                const newPartRaw = (typeof localKeypadValue === 'object') ? localKeypadValue.value : localKeypadValue;
                const newPart = parseFloat(String(newPartRaw)) || 0;
                if (newPart !== 0) {
                    const currentHistory = getScoreHistory(cellScoreObject);
                    const newHistory = [...currentHistory, String(newPart)];
                    const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                    updateScore(activePlayer!.id, activeColumn!.id, { value: newSum, history: newHistory });
                    setLocalKeypadValue(0);
                    setUiState((p: any) => ({ ...p, overwriteMode: true }));
                } else {
                    eventHandlers.moveToNext();
                }
            } else if (isProductMode && activeFactorIdx === 0) {
                 const n1 = parseFloat(String(cellScoreObject?.parts?.[0] ?? 0)) || 0;
                 if (n1 !== 0) setActiveFactorIdx(1);
                 else eventHandlers.moveToNext();
            } else {
                eventHandlers.moveToNext();
            }
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
             
             if (isSumPartsMode) {
                  const currentHistory = getScoreHistory(cellScoreObject);
                  let newHistory = [...currentHistory];
                  if (action.isModifier && newHistory.length > 0) {
                       newHistory[newHistory.length - 1] = String(parseFloat(newHistory[newHistory.length - 1]) + action.value);
                  } else {
                       newHistory.push(String(action.value));
                  }
                  const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                  updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
             } else { // It's a select list, so it replaces the value and moves next
                  updateScore(activePlayer.id, activeColumn.id, { value: action.value });
                  eventHandlers.moveToNext();
             }
        };

        if (isSumPartsMode && activeColumn.inputType === 'keypad') {
            const newPart = parseFloat(String(getRawValue(localKeypadValue))) || 0;
            if (newPart !== 0) nextButtonContent = <ArrowUpToLine size={28} />;
        } else if (isProductMode && activeFactorIdx === 0) {
             const n1 = parseFloat(String(cellScoreObject?.parts?.[0] ?? 0)) || 0;
             if (n1 !== 0) nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">輸入 {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
        }
        
        if (activeColumn.inputType === 'clicker') {
             mainContentNode = ( <QuickButtonPad column={activeColumn} onAction={handleQuickButtonAction} /> );
             if (isSumPartsMode) {
                sidebarContentNode = <NumericKeypadInfo column={activeColumn} value={cellScoreObject} onDeleteLastPart={handleDeleteLastPart} />;
             } else {
                sidebarContentNode = ( <div className="flex flex-col h-full p-2 text-slate-400 text-xs"><div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><ListPlus size={12} /> 列表選單</div><div className="flex-1"></div></div> );
             }
        } else { // 'keypad'
            let keypadValue;
            if (isSumPartsMode) { keypadValue = localKeypadValue; } 
            else if (isProductMode) { keypadValue = { factors: cellScoreObject?.parts ?? [0, 1] }; } 
            else { keypadValue = { value: cellScoreObject?.parts?.[0] ?? 0 }; }
            
            mainContentNode = <NumericKeypadContent 
                value={keypadValue}
                onChange={(val: any) => isSumPartsMode ? setLocalKeypadValue(val) : updateScore(activePlayer!.id, activeColumn!.id, val)}
                column={activeColumn} overwrite={overwriteMode} setOverwrite={(v: boolean) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                onNext={onNextAction} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx} playerId={activePlayer.id}
            />;
            sidebarContentNode = <NumericKeypadInfo 
              column={activeColumn} value={cellScoreObject} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx}
              localKeypadValue={isSumPartsMode ? localKeypadValue : undefined}
              onDeleteLastPart={isSumPartsMode ? handleDeleteLastPart : undefined}
            />;
        }
    }
  }

  return (
    <div
      className={`fixed left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-sm border-t border-slate-700/50 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all ease-in-out flex flex-col overflow-hidden ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'} ${isInputFocused ? 'duration-0' : 'duration-300'}`}
      style={{ height: panelHeight, bottom: visualViewportOffset }}
    >
      {activePlayer && (
        <PanelHeader player={activePlayer} col={activeColumn} isEditingPlayer={isEditingPlayerName} onClear={handleClear} onDirectionToggle={handleDirectionToggle} direction={advanceDirection} />
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

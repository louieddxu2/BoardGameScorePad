import React from 'react';
import { GameSession, GameTemplate, Player } from '../../../types';
import { useSessionState } from '../hooks/useSessionState';
import { useSessionEvents } from '../hooks/useSessionEvents';
import NumericKeypad from '../../shared/NumericKeypad';
import PlayerEditor from './PlayerEditor';
import SelectOptionInput from './SelectOptionInput';
import { Eraser } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface InputPanelProps {
  sessionState: ReturnType<typeof useSessionState>;
  eventHandlers: ReturnType<typeof useSessionEvents>;
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  onUpdateSession: (session: GameSession) => void;
  onUpdatePlayerHistory: (name: string) => void;
}

const InputPanel: React.FC<InputPanelProps> = (props) => {
  const { sessionState, eventHandlers, session, template, playerHistory, onUpdateSession, onUpdatePlayerHistory } = props;
  const { uiState, setUiState, panelHeight } = sessionState;
  const { editingCell, editingPlayerId, isInputFocused } = uiState;
  
  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  const updateScore = (playerId: string, colId: string, value: any) => {
    const players = session.players.map(p =>
      p.id !== playerId ? p : { ...p, scores: { ...p.scores, [colId]: value } }
    );
    onUpdateSession({ ...session, players });
  };
  
  const renderPanelHeader = (title: string, player: Player, extraControls?: React.ReactNode) => (
      <div 
        className="border-b h-10 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar shrink-0 transition-colors"
        style={{ backgroundColor: `${player.color}20`, borderColor: `${player.color}40` }}
      >
          <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: player.color }}>{title}</span>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <span className="text-sm font-bold truncate max-w-[120px]" style={{ color: player.color, ...(isColorDark(player.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
            {player.name}
          </span>
          <div className="flex-1"></div>
          {extraControls}
      </div>
  );

  const renderContent = () => {
    if (editingPlayerId) {
      const player = session.players.find(p => p.id === editingPlayerId);
      if (!player) return null;
      return (
        <PlayerEditor 
          player={player}
          playerHistory={playerHistory}
          tempName={uiState.tempPlayerName}
          setTempName={(name) => setUiState(p => ({...p, tempPlayerName: name}))}
          isInputFocused={isInputFocused}
          setIsInputFocused={(focused) => setUiState(p => ({...p, isInputFocused: focused}))}
          onUpdatePlayerColor={(color) => onUpdateSession({ ...session, players: session.players.map(p => p.id === editingPlayerId ? { ...p, color } : p) })}
          onNameSubmit={eventHandlers.handlePlayerNameSubmit}
        />
      );
    }

    if (editingCell) {
      const col = template.columns.find(c => c.id === editingCell.colId);
      const player = session.players.find(p => p.id === editingCell.playerId);
      if (!col || !player) return null;

      const currentValue = player.scores[col.id];
      const extraControls = (
         <button onClick={() => { updateScore(player.id, col.id, undefined); setUiState(p => ({...p, overwriteMode: true})); }} className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs border border-red-500/30 hover:bg-red-900/50 flex items-center gap-1"><Eraser size={12} /> 清除</button>
      );
      
      return (
        <div className="flex flex-col h-full">
          {renderPanelHeader(col.name, player, extraControls)}
          <div className="flex-1 min-h-0">
            {col.type === 'number' && (
              <NumericKeypad 
                value={currentValue} 
                onChange={(val) => updateScore(player.id, col.id, val)} 
                onNext={eventHandlers.moveToNext} 
                direction={uiState.advanceDirection} 
                column={col} 
                overwrite={uiState.overwriteMode} 
                setOverwrite={(v) => setUiState(p => ({...p, overwriteMode: v}))} 
              />
            )}
            {(col.type === 'select' || col.type === 'boolean') && (
              <SelectOptionInput
                column={col}
                currentValue={currentValue}
                onSelect={(value) => { updateScore(player.id, col.id, value); eventHandlers.moveToNext(); }}
                onNext={eventHandlers.moveToNext}
                direction={uiState.advanceDirection}
              />
            )}
          </div>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ height: (editingPlayerId && isInputFocused) ? 'auto' : panelHeight }}
    >
      {renderContent()}
    </div>
  );
};

export default InputPanel;

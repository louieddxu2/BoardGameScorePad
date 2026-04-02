import { useEffect, useRef } from 'react';
import { GameSession, GameTemplate } from '../../../types';
import { voiceService } from '../../../services/voiceService';
import { calculateColumnScore, calculatePlayerTotal, resolveSelectedOptions } from '../../../utils/scoring';

interface VoiceAnnouncementsProps {
  isVoiceEnabled?: boolean;
  language: string;
  uiState: {
    editingCell: { playerId: string; colId: string } | null;
    editingPlayerId: string | null;
  };
  session: GameSession;
  template: GameTemplate;
  t: (key: any, options?: any) => string;
}

export const useVoiceAnnouncements = ({
  isVoiceEnabled,
  language,
  uiState,
  session,
  template,
  t
}: VoiceAnnouncementsProps) => {
  // Sync language and custom mappings with voice service
  useEffect(() => {
    voiceService.setLanguage(language);
    
    // Sync tokens for number-to-text conversion
    voiceService.setTokens(t('voice_digits'), t('voice_units'), t('voice_negative'));

    // Sync custom mappings (e.g., problematic numbers)
    const map5 = t('voice_special_map_5');
    if (map5 && map5 !== '5') {
      voiceService.setCustomMappings({ "5": map5 });
    } else {
      voiceService.setCustomMappings({});
    }
  }, [language, t]);

  // Track the previously active cell to detect "leaving"
  const prevCellRef = useRef<{ playerId: string; colId: string } | null>(null);

  // Main announcement logic - Triggered on cell "Exit"
  useEffect(() => {
    const currentCell = uiState.editingCell;
    
    // Detect "Leaving a Cell": 
    // Previous was something, and current is different (another cell or null)
    if (prevCellRef.current && 
        (currentCell === null || 
         currentCell.playerId !== prevCellRef.current.playerId || 
         currentCell.colId !== prevCellRef.current.colId)) {
      
      if (isVoiceEnabled) {
        const { playerId, colId } = prevCellRef.current;
        const player = session.players.find(p => p.id === playerId);
        const col = colId === '__TOTAL__' 
          ? { id: '__TOTAL__', name: t('input_total_adjust'), isScoring: false } // Mock col for Total
          : template.columns.find(c => c.id === colId);

        if (player && col) {
          const scoreValue = player.scores[colId];
          let textToSpeak = '';

          // 1. [Special] Total Mode Adjustment
          if (colId === '__TOTAL__') {
            const total = calculatePlayerTotal(player, template, session.players);
            textToSpeak = t('voice_total_announcement', { score: total, name: player.name });
          } 
          // 2. [Feature] Label Only Mode (List Selection)
          else if (col && (col as any).renderMode === 'label_only') {
            const options = resolveSelectedOptions(col as any, scoreValue);
            textToSpeak = options.map(o => o.label).join(', ');
          }
          // 3. [Standard] Numeric Total for this cell
          else if (col && scoreValue) {
            const score = calculateColumnScore(col as any, scoreValue.parts, undefined, scoreValue);
            textToSpeak = t('voice_score_announcement', { score });
          }

          if (textToSpeak) {
            voiceService.speak(textToSpeak, true);
          }
        }
      }
    }

    // Update ref for next change
    prevCellRef.current = currentCell;
  }, [
    uiState.editingCell, 
    isVoiceEnabled, 
    session.players, 
    template.columns, 
    t,
    template
  ]);
};

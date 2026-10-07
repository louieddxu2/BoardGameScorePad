import type { GameSession, GameTemplate, SavedListItem } from '../../types';
import type { SessionUpdateOptions } from '../../hooks/useSessionManager';
import type { SessionCapabilities } from '../../features/multiplayer/sessionCapabilities';
import type { MultiplayerSessionManager } from '../../features/multiplayer/multiplayerSessionManager';

export interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  savedPlayers: SavedListItem[]; // Renamed from playerHistory
  allSavedPlayers?: SavedListItem[];
  savedLocations?: SavedListItem[]; // Renamed from locationHistory
  zoomLevel: number;
  baseImage: string | null;
  onUpdateSession: (session: GameSession, options?: SessionUpdateOptions) => void;
  onUpdateTemplate: (template: GameTemplate) => Promise<{ template: GameTemplate; session: GameSession | null }>;
  onUpdateSavedPlayer: (name: string) => void; // Renamed from onUpdatePlayerHistory
  onUpdateImage: (img: string | Blob | null) => void;
  onExit: (location?: string) => void;
  onResetScores: () => void;
  onSaveToHistory: (location?: string) => void;
  onDiscard: () => void;
  isVoiceEnabled?: boolean;
  onToggleVoice?: () => void;
  multiplayerCapabilities?: SessionCapabilities;
  multiplayerRoomId?: string;
  multiplayerManager?: MultiplayerSessionManager;
  onOpenMultiplayerRoom?: () => void;
  onOpenMultiplayerParticipantRoom?: () => void;
  onRequestMultiplayerPlayerClaim?: (playerId: string) => void;
}

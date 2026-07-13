import { ScoreColumn } from '../../types';

export interface SessionCapabilities {
  role: 'host' | 'player';
  playerId?: string;
  canEditScore(playerId: string, column: ScoreColumn | undefined): boolean;
  canEditPlayers: boolean;
  canEditTemplate: boolean;
  canManageSession: boolean;
  canUseMediaTools: boolean;
  canOpenToolbox: boolean;
}

export const hostSessionCapabilities: SessionCapabilities = {
  role: 'host',
  canEditScore: () => true,
  canEditPlayers: true,
  canEditTemplate: true,
  canManageSession: true,
  canUseMediaTools: true,
  canOpenToolbox: true,
};

export const createPlayerSessionCapabilities = (playerId: string): SessionCapabilities => ({
  role: 'player',
  playerId,
  canEditScore(targetPlayerId, column) {
    return targetPlayerId === playerId && !!column && !column.isShared && column.inputType !== 'auto';
  },
  canEditPlayers: false,
  canEditTemplate: false,
  canManageSession: false,
  canUseMediaTools: false,
  canOpenToolbox: false,
});

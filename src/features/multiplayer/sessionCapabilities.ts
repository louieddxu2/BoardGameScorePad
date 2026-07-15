import { ScoreColumn } from '../../types';

export interface SessionCapabilities {
  role: 'host' | 'player';
  playerId?: string;
  playerIds?: string[];
  canEditScore(playerId: string, column: ScoreColumn | undefined): boolean;
  canEditTotal(playerId: string): boolean;
  canEditPlayers: boolean;
  canEditTemplate: boolean;
  canManageSession: boolean;
  canUseMediaTools: boolean;
  canOpenToolbox: boolean;
}

export const hostSessionCapabilities: SessionCapabilities = {
  role: 'host',
  canEditScore: () => true,
  canEditTotal: () => true,
  canEditPlayers: true,
  canEditTemplate: true,
  canManageSession: true,
  canUseMediaTools: true,
  canOpenToolbox: true,
};

export const createPlayerSessionCapabilities = (claimedPlayerIds: string | string[]): SessionCapabilities => {
  const playerIds = Array.isArray(claimedPlayerIds) ? [...new Set(claimedPlayerIds)] : [claimedPlayerIds];
  return {
  role: 'player',
  playerId: playerIds[0],
  playerIds,
  canEditScore(targetPlayerId, column) {
    return playerIds.includes(targetPlayerId) && !!column && !column.isShared && column.inputType !== 'auto';
  },
  canEditTotal(targetPlayerId) {
    return playerIds.includes(targetPlayerId);
  },
  canEditPlayers: false,
  canEditTemplate: false,
  canManageSession: false,
  canUseMediaTools: true,
  canOpenToolbox: false,
  };
};

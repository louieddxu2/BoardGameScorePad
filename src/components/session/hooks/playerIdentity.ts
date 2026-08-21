import { Player } from '../../../types';

export const resolveManualIdentityFlag = (
  currentPlayer: Player,
  finalName: string,
  finalLinkedId: string | undefined,
  wasExplicitlySelected: boolean
): boolean => {
  if (!finalName) return false;

  return currentPlayer.name !== finalName
    || currentPlayer.linkedPlayerId !== finalLinkedId
    || wasExplicitlySelected
    || !!currentPlayer.isIdentityManuallySet;
};

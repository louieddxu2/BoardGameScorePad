
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { SavedListItem } from '../../types';

const EMPTY_SAVED_GAMES: SavedListItem[] = [];

export const useSavedGameQuery = () => {
  const allSavedGames = useLiveQuery(() => db.savedGames.orderBy('usageCount').reverse().toArray(), []);
  return {
      savedGames: allSavedGames ?? EMPTY_SAVED_GAMES,
      savedGamesLoaded: allSavedGames !== undefined,
  };
};

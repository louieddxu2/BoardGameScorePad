
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';

export const useLibraryQuery = () => {
  // --- LISTS ---
  const savedPlayersAllData = useLiveQuery(() => db.savedPlayers.toArray(), []);
  const savedPlayersData = useLiveQuery(() => db.savedPlayers.orderBy('lastUsed').reverse().limit(DATA_LIMITS.QUERY.SAVED_LIST_ITEMS).toArray(), [], []);
  const savedLocationsData = useLiveQuery(() => db.savedLocations.orderBy('lastUsed').reverse().limit(DATA_LIMITS.QUERY.SAVED_LIST_ITEMS).toArray(), [], []);

  // Rename to be explicit: These are "Saved Lists", not "History Records"
  const savedPlayersAll = useMemo(() => savedPlayersAllData, [savedPlayersAllData]);
  const savedPlayers = useMemo(() => savedPlayersData || [], [savedPlayersData]);
  const savedLocations = useMemo(() => savedLocationsData || [], [savedLocationsData]);

  return {
      savedPlayersAll,
      savedPlayers,
      savedLocations
  };
};

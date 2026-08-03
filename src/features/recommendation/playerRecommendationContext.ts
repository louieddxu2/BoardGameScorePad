import { db } from '../../db';
import { Voter } from './ContextResolver';

/** Load the game/location voters shared by player recommendation surfaces. */
export async function loadPlayerRecommendationContextVoters(
    gameName?: string,
    locationName?: string
): Promise<Voter[]> {
    const [gameItem, locationItem] = await Promise.all([
        gameName ? db.savedGames.where('name').equals(gameName).first() : Promise.resolve(undefined),
        locationName ? db.savedLocations.where('name').equals(locationName).first() : Promise.resolve(undefined)
    ]);

    const voters: Voter[] = [];
    if (gameItem) voters.push({ item: gameItem, factor: 'game' });
    if (locationItem) voters.push({ item: locationItem, factor: 'location' });
    return voters;
}

import { BggGame, TemplatePreference, SystemWeightConfig } from '../types';
import {
  COUNT_WEIGHTS_ID,
  LOCATION_WEIGHTS_ID,
  PLAYER_WEIGHTS_ID
} from '../features/recommendation/WeightAdjustmentEngine';

export interface SessionContextWeights {
  player?: number;
  count?: number;
  location?: number;
}

export interface SystemBackupV2 {
  bggGames?: BggGame[];
  templatePrefs?: TemplatePreference[];
  sessionContextWeights?: SessionContextWeights;
}

export const SESSION_CONTEXT_WEIGHT_MODEL_IDS = {
  player: PLAYER_WEIGHTS_ID,
  count: COUNT_WEIGHTS_ID,
  location: LOCATION_WEIGHTS_ID
} as const;

const hasTimestamp = (item: { updatedAt?: number } | undefined): item is { updatedAt: number } =>
  typeof item?.updatedAt === 'number' && Number.isFinite(item.updatedAt);

export const mergeBggGames = (local: BggGame[] = [], cloud: BggGame[] = []): BggGame[] => {
  const merged = new Map<string, BggGame>();

  cloud.forEach(game => {
    if (game?.id) merged.set(game.id, game);
  });

  local.forEach(game => {
    if (!game?.id) return;
    const cloudGame = merged.get(game.id);

    if (!cloudGame) {
      merged.set(game.id, game);
      return;
    }

    if (!hasTimestamp(cloudGame)) {
      merged.set(game.id, game);
      return;
    }

    if (!hasTimestamp(game) || cloudGame.updatedAt > game.updatedAt) {
      merged.set(game.id, cloudGame);
    } else {
      merged.set(game.id, game);
    }
  });

  return Array.from(merged.values());
};

export const mergeTemplatePrefs = (
  local: TemplatePreference[] = [],
  cloud: TemplatePreference[] = []
): TemplatePreference[] => {
  const merged = new Map<string, TemplatePreference>();

  cloud.forEach(pref => {
    if (pref?.templateId) merged.set(pref.templateId, pref);
  });

  local.forEach(pref => {
    if (!pref?.templateId) return;
    const cloudPref = merged.get(pref.templateId);
    const localUpdatedAt = pref.updatedAt || 0;
    const cloudUpdatedAt = cloudPref?.updatedAt || 0;

    if (!cloudPref || localUpdatedAt >= cloudUpdatedAt) {
      merged.set(pref.templateId, pref);
    }
  });

  return Array.from(merged.values());
};

export const extractSessionContextWeights = (
  configs: Array<SystemWeightConfig | undefined | null>
): SessionContextWeights => {
  const byId = new Map(configs.filter(Boolean).map(config => [config!.id, config!]));

  return {
    player: byId.get(PLAYER_WEIGHTS_ID)?.weights?.sessionContext,
    count: byId.get(COUNT_WEIGHTS_ID)?.weights?.sessionContext,
    location: byId.get(LOCATION_WEIGHTS_ID)?.weights?.sessionContext
  };
};

export const mergeSessionContextWeights = (
  local: SessionContextWeights = {},
  cloud: SessionContextWeights = {}
): SessionContextWeights => ({
  player: local.player ?? cloud.player,
  count: local.count ?? cloud.count,
  location: local.location ?? cloud.location
});

export const getSessionContextWeightUpdates = (weights?: SessionContextWeights) => {
  if (!weights) return [];

  return (Object.entries(SESSION_CONTEXT_WEIGHT_MODEL_IDS) as Array<[
    keyof SessionContextWeights,
    string
  ]>)
    .map(([key, id]) => ({ id, value: weights[key] }))
    .filter((entry): entry is { id: string; value: number } =>
      typeof entry.value === 'number' && Number.isFinite(entry.value)
    );
};

/** Compare JSON-shaped content in linear time, ignoring only the top-level backup timestamp. */
export const hasSameSystemBackupContent = (
  left: Record<string, unknown>, right: Record<string, unknown>,
): boolean => {
  const equal = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for (let index = 0; index < a.length; index++) {
        if (!equal(a[index], b[index])) return false;
      }
      return true;
    }
    // Non-JSON objects are not assumed equal merely because they have no enumerable keys.
    const isPlain = (value: object) => [Object.prototype, null].includes(Object.getPrototypeOf(value));
    if (!isPlain(a) || !isPlain(b)) return false;
    const aObject = a as Record<string, unknown>;
    const bObject = b as Record<string, unknown>;
    const keys = Object.keys(aObject).filter(key => aObject[key] !== undefined);
    return keys.length === Object.keys(bObject).filter(key => bObject[key] !== undefined).length &&
      keys.every(key => Object.prototype.hasOwnProperty.call(bObject, key) && equal(aObject[key], bObject[key]));
  };
  const { timestamp: _leftTimestamp, ...leftContent } = left;
  const { timestamp: _rightTimestamp, ...rightContent } = right;
  return equal(leftContent, rightContent);
};

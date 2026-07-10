import { GameSession, GameTemplate, HistoryRecord } from '../../types';
import { calculateWinners, isDisposableTemplate } from '../../utils/templateUtils';

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createHistoryRecordFromFinalSnapshot = (options: {
  template: GameTemplate;
  session: GameSession;
  completedAt: number;
  location?: string;
}): HistoryRecord => {
  const rule = options.session.scoringRule || 'HIGHEST_WINS';
  const trimmedLocation = options.location !== undefined
    ? options.location.trim()
    : options.session.location?.trim();

  return {
    id: options.session.id,
    templateId: options.template.id,
    gameName: options.session.name || options.template.name,
    bggId: options.session.bggId || options.template.bggId,
    startTime: options.session.startTime,
    endTime: options.completedAt,
    updatedAt: options.completedAt,
    players: cloneJson(options.session.players),
    winnerIds: calculateWinners(options.session.players, rule),
    snapshotTemplate: (isDisposableTemplate(options.template) ? undefined : cloneJson(options.template)) as any,
    location: trimmedLocation,
    locationId: options.session.locationId,
    note: options.session.note || '',
    photos: cloneJson(options.session.photos || []),
    photoCloudIds: cloneJson(options.session.photoCloudIds || {}),
    cloudFolderId: options.session.cloudFolderId,
    scoringRule: rule,
  };
};

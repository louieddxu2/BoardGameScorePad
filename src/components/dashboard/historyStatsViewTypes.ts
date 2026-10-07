import type { useHistoryStatsTranslation } from '../../i18n/history_stats';

export type HistoryStatsTranslate = ReturnType<typeof useHistoryStatsTranslation>['t'];

export type HistoryStatsOverviewTab = 'games' | 'players';
export type HistoryStatsDetailView =
  | { type: 'game'; key: string; tab: 'players' | 'records' }
  | { type: 'player'; key: string; tab: 'games' | 'records' };

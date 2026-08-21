import { InspectorTranslationKey } from '../../../../i18n/inspector';

export const LIFECYCLE_BUCKET_LABEL_KEYS: Record<string, InspectorTranslationKey> = {
    'game_play_stage:first': 'lifecycle_stage_first',
    'game_play_stage:second': 'lifecycle_stage_second',
    'game_play_stage:third_to_fourth': 'lifecycle_stage_third_to_fourth',
    'game_play_stage:fifth_to_ninth': 'lifecycle_stage_fifth_to_ninth',
    'game_play_stage:tenth_plus': 'lifecycle_stage_tenth_plus',
    'game_recency:within_1_day': 'lifecycle_recency_within_1_day',
    'game_recency:within_7_days': 'lifecycle_recency_within_7_days',
    'game_recency:within_30_days': 'lifecycle_recency_within_30_days',
    'game_recency:within_90_days': 'lifecycle_recency_within_90_days',
    'game_recency:over_90_days': 'lifecycle_recency_over_90_days'
};

export function getLifecycleBucketLabel(
    id: string,
    t: (key: InspectorTranslationKey) => string
): string {
    const key = LIFECYCLE_BUCKET_LABEL_KEYS[id];
    return key ? t(key) : id;
}

import { describe, expect, it } from 'vitest';
import { inspectorTranslations, InspectorTranslationKey } from '../../../../i18n/inspector';
import {
    GAME_PLAY_STAGE_BUCKET_IDS,
    GAME_RECENCY_BUCKET_IDS
} from '../../../../services/relationship/GameTemporalContextResolver';
import { getLifecycleBucketLabel } from './lifecycleLabels';

describe('lifecycle inspector labels', () => {
    const zh = (key: InspectorTranslationKey) => inspectorTranslations['zh-TW'][key];
    const en = (key: InspectorTranslationKey) => inspectorTranslations.en[key];

    it('shows play-stage buckets in classifier order with Chinese labels', () => {
        expect(GAME_PLAY_STAGE_BUCKET_IDS.map(id => getLifecycleBucketLabel(id, zh))).toEqual([
            '第 1 局',
            '第 2 局',
            '第 3–4 局',
            '第 5–9 局',
            '第 10 局以上'
        ]);
    });

    it('shows recency buckets in classifier order with Chinese labels', () => {
        expect(GAME_RECENCY_BUCKET_IDS.map(id => getLifecycleBucketLabel(id, zh))).toEqual([
            '24 小時內',
            '超過 24 小時，7 天內',
            '超過 7 天，30 天內',
            '超過 30 天，90 天內',
            '超過 90 天'
        ]);
    });

    it('provides English labels for every lifecycle bucket', () => {
        expect([...GAME_PLAY_STAGE_BUCKET_IDS, ...GAME_RECENCY_BUCKET_IDS]
            .map(id => getLifecycleBucketLabel(id, en)))
            .not.toContain(expect.stringMatching(/^game_/));
    });
});

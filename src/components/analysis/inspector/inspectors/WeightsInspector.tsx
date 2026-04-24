
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Scale, BrainCircuit, Calculator, MapPin, Palette } from 'lucide-react';
import { DEFAULT_PLAYER_WEIGHTS, PlayerRecommendationWeights, DEFAULT_COUNT_WEIGHTS, CountRecommendationWeights, DEFAULT_LOCATION_WEIGHTS, LocationRecommendationWeights, DEFAULT_COLOR_WEIGHTS, ColorRecommendationWeights } from '../../../../features/recommendation/types';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID, COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID, COLOR_WEIGHTS_ID } from '../../../../features/recommendation/WeightAdjustmentEngine';
import { useInspectorTranslation } from '../shared/InspectorCommon';
import { useConfirm } from '../../../../hooks/useConfirm';

// Reusable Component for displaying a single engine's weights
const EngineWeightSection: React.FC<{
    title: string;
    desc: string;
    icon: React.ReactNode;
    weights: Record<string, number>;
    onReset: () => void;
    colorTheme?: 'indigo' | 'amber' | 'rose' | 'pink';
}> = ({ title, desc, icon, weights, onReset, colorTheme = 'indigo' }) => {
    const t = useInspectorTranslation();

    const getFactorLabel = (key: string) => {
        switch (key) {
            case 'game': return t('factor_game');
            case 'location': return t('factor_location');
            case 'weekday': return t('factor_weekday');
            case 'timeSlot': return t('factor_timeSlot');
            case 'playerCount': return t('factor_playerCount');
            case 'gameMode': return t('factor_gameMode');
            case 'relatedPlayer': return t('factor_relatedPlayer');
            case 'sessionContext': return t('factor_sessionContext');
            case 'templateSetting': return t('factor_templateSetting');
            case 'player': return t('factor_player');
            default: return key;
        }
    };

    const renderCompactRow = (key: string, value: number) => {
        const percentage = Math.min(100, (value / 5.0) * 100);
        let colorClass = 'bg-txt-muted';
        let textColor = 'text-txt-muted';

        if (value >= 3.0) { colorClass = 'bg-status-success'; textColor = 'text-status-success'; }
        else if (value >= 1.5) { colorClass = 'bg-brand-secondary'; textColor = 'text-brand-secondary'; }
        else if (value < 0.8) { colorClass = 'bg-status-danger'; textColor = 'text-status-danger'; }

        return (
            <div key={key} className="flex items-center gap-3 py-2 border-b border-surface-border/30 last:border-0">
                <div className="w-24 text-xs font-bold text-txt-secondary truncate">
                    {getFactorLabel(key)}
                </div>
                <div className="flex-1 h-1.5 modal-bg-recessed rounded-full overflow-hidden">
                    <div
                        className={`h-full ${colorClass} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className={`w-10 text-right text-xs font-mono font-bold ${textColor}`}>
                    {value.toFixed(1)}
                </div>
            </div>
        );
    };

    let semanticColor = 'brand-primary';
    if (colorTheme === 'amber') semanticColor = 'status-warning';
    if (colorTheme === 'rose') semanticColor = 'status-danger';
    if (colorTheme === 'pink') semanticColor = 'brand-secondary';

    const bgHeaderClass = `bg-${semanticColor}/10 border-b border-${semanticColor}/20`;
    const iconBgClass = `bg-${semanticColor}/20 text-${semanticColor}`;
    const titleClass = `text-${semanticColor}`;
    const descClass = `text-txt-muted`;

    return (
        <div className="modal-bg-elevated border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <div className={`${bgHeaderClass} p-3 flex items-start gap-3`}>
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${iconBgClass}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <h3 className={`font-bold text-sm ${titleClass}`}>{title}</h3>
                        <button
                            onClick={onReset}
                            className="text-[10px] flex items-center gap-1 text-txt-muted hover:text-txt-primary modal-bg-recessed hover:filter hover:brightness-110 px-2 py-1 rounded transition-all border border-surface-border active:scale-95"
                        >
                            <RotateCcw size={10} />
                            {t('btn_reset_weights')}
                        </button>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${descClass}`}>
                        {desc}
                    </p>
                </div>
            </div>

            <div className="p-3">
                <div className="flex justify-between text-[10px] text-txt-muted/60 uppercase font-bold mb-2 px-1">
                    <span>{t('weight_factor')}</span>
                    <span>{t('weight_value')} (0.2~5.0)</span>
                </div>

                <div className="modal-bg-recessed/30 rounded-lg border border-surface-border/50 px-3">
                    {weights && Object.entries(weights).map(([key, val]) => (
                        renderCompactRow(key, val as number)
                    ))}
                </div>
            </div>
        </div>
    );
}

const WeightsInspector: React.FC = () => {
    const t = useInspectorTranslation();
    const { confirm } = useConfirm();

    const playerWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);
    }, [], DEFAULT_PLAYER_WEIGHTS);

    const countWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);
    }, [], DEFAULT_COUNT_WEIGHTS);

    const locationWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);
    }, [], DEFAULT_LOCATION_WEIGHTS);

    const colorWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
    }, [], DEFAULT_COLOR_WEIGHTS);

    const handleResetPlayer = async () => {
        if (await confirm({ title: t('btn_reset_weights'), message: t('confirm_reset_player'), isDangerous: true })) {
            // Reset player model factors, but ignore 'sessionContext' (short-term memory)
            await weightAdjustmentEngine.resetWeightsExcept(
                PLAYER_WEIGHTS_ID,
                DEFAULT_PLAYER_WEIGHTS,
                ['sessionContext']
            );
        }
    };

    const handleResetCount = async () => {
        if (await confirm({ title: t('btn_reset_weights'), message: t('confirm_reset_count'), isDangerous: true })) {
            // Reset count model factors, but ignore 'sessionContext'
            await weightAdjustmentEngine.resetWeightsExcept(
                COUNT_WEIGHTS_ID,
                DEFAULT_COUNT_WEIGHTS,
                ['sessionContext']
            );
        }
    };

    const handleResetLocation = async () => {
        if (await confirm({ title: t('btn_reset_weights'), message: t('confirm_reset_location'), isDangerous: true })) {
            // Reset location model factors, but ignore 'sessionContext'
            await weightAdjustmentEngine.resetWeightsExcept(
                LOCATION_WEIGHTS_ID,
                DEFAULT_LOCATION_WEIGHTS,
                ['sessionContext']
            );
        }
    };

    const handleResetColor = async () => {
        if (await confirm({ title: t('btn_reset_weights'), message: t('confirm_reset_color'), isDangerous: true })) {
            await weightAdjustmentEngine.saveWeights(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-app-bg">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-2 mb-4">
                    <Scale size={20} className="text-brand-primary" />
                    <div>
                        <h2 className="text-lg font-bold text-txt-primary leading-none">{t('weights_title')}</h2>
                        <span className="text-xs text-txt-muted">{t('weights_subtitle')}</span>
                    </div>
                </div>

                <EngineWeightSection
                    title={t('engine_player_title')}
                    desc={t('engine_player_desc')}
                    icon={<BrainCircuit size={16} />}
                    weights={playerWeights as unknown as Record<string, number>}
                    onReset={handleResetPlayer}
                    colorTheme="indigo"
                />

                <EngineWeightSection
                    title={t('engine_count_title')}
                    desc={t('engine_count_desc')}
                    icon={<Calculator size={16} />}
                    weights={countWeights as unknown as Record<string, number>}
                    onReset={handleResetCount}
                    colorTheme="amber"
                />

                <EngineWeightSection
                    title={t('engine_location_title')}
                    desc={t('engine_location_desc')}
                    icon={<MapPin size={16} />}
                    weights={locationWeights as unknown as Record<string, number>}
                    onReset={handleResetLocation}
                    colorTheme="rose"
                />

                <EngineWeightSection
                    title={t('engine_color_title')}
                    desc={t('engine_color_desc')}
                    icon={<Palette size={16} />}
                    weights={colorWeights as unknown as Record<string, number>}
                    onReset={handleResetColor}
                    colorTheme="pink"
                />
            </div>
        </div>
    );
};

export default WeightsInspector;

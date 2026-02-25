
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Scale, BrainCircuit, Calculator, MapPin, Palette } from 'lucide-react';
import { DEFAULT_PLAYER_WEIGHTS, PlayerRecommendationWeights, DEFAULT_COUNT_WEIGHTS, CountRecommendationWeights, DEFAULT_LOCATION_WEIGHTS, LocationRecommendationWeights, DEFAULT_COLOR_WEIGHTS, ColorRecommendationWeights } from '../../features/recommendation/types';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID, COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID, COLOR_WEIGHTS_ID } from '../../features/recommendation/WeightAdjustmentEngine';
import { useInspectorTranslation } from './InspectorShared';

// Reusable Component for displaying a single engine's weights
const EngineWeightSection: React.FC<{
    title: string;
    desc: string;
    icon: React.ReactNode;
    weights: Record<string, number>;
    onReset: () => void;
    colorTheme?: 'indigo' | 'amber' | 'rose' | 'pink'; // Added 'pink'
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
        // Max value is 5.0
        const percentage = Math.min(100, (value / 5.0) * 100);

        let colorClass = 'bg-slate-500'; // Default ~1.0
        let textColor = 'text-slate-400';

        if (value >= 3.0) { colorClass = 'bg-emerald-500'; textColor = 'text-emerald-400'; }
        else if (value >= 1.5) { colorClass = 'bg-sky-500'; textColor = 'text-sky-400'; }
        else if (value < 0.8) { colorClass = 'bg-rose-500'; textColor = 'text-rose-400'; }

        return (
            <div key={key} className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0">
                {/* Label */}
                <div className="w-24 text-xs font-bold text-slate-300 truncate">
                    {getFactorLabel(key)}
                </div>

                {/* Bar */}
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${colorClass} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Value */}
                <div className={`w-10 text-right text-xs font-mono font-bold ${textColor}`}>
                    {value.toFixed(1)}
                </div>
            </div>
        );
    };

    // Dynamic styles based on theme
    let themeClass = 'indigo';
    if (colorTheme === 'amber') themeClass = 'amber';
    if (colorTheme === 'rose') themeClass = 'rose';
    if (colorTheme === 'pink') themeClass = 'pink';

    const bgHeaderClass = `bg-${themeClass}-900/20 border-b border-${themeClass}-500/20`;
    const iconBgClass = `bg-${themeClass}-500/20 text-${themeClass}-400`;
    const titleClass = `text-${themeClass}-200`;
    const descClass = `text-${themeClass}-300/60`;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Engine Header */}
            <div className={`${bgHeaderClass} p-3 flex items-start gap-3`}>
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${iconBgClass}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <h3 className={`font-bold text-sm ${titleClass}`}>{title}</h3>
                        <button
                            onClick={onReset}
                            className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors border border-slate-700"
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

            {/* Weights List */}
            <div className="p-3">
                <div className="flex justify-between text-[10px] text-slate-600 uppercase font-bold mb-2 px-1">
                    <span>{t('weight_factor')}</span>
                    <span>{t('weight_value')} (0.2~5.0)</span>
                </div>

                <div className="bg-slate-950/50 rounded-lg border border-slate-800/50 px-3">
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

    // 1. Live query for Player Weights
    const playerWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);
    }, [], DEFAULT_PLAYER_WEIGHTS);

    // 2. Live query for Count Weights
    const countWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);
    }, [], DEFAULT_COUNT_WEIGHTS);

    // 3. Live query for Location Weights
    const locationWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);
    }, [], DEFAULT_LOCATION_WEIGHTS);

    // 4. Live query for Color Weights
    const colorWeights = useLiveQuery(async () => {
        return await weightAdjustmentEngine.getWeights(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
    }, [], DEFAULT_COLOR_WEIGHTS);

    const handleResetPlayer = async () => {
        if (confirm('確定要重置「玩家預測」模型為預設值嗎？')) {
            await weightAdjustmentEngine.saveWeights(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);
        }
    };

    const handleResetCount = async () => {
        if (confirm('確定要重置「人數預測」模型為預設值嗎？')) {
            await weightAdjustmentEngine.saveWeights(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);
        }
    };

    const handleResetLocation = async () => {
        if (confirm('確定要重置「地點預測」模型為預設值嗎？')) {
            await weightAdjustmentEngine.saveWeights(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);
        }
    };

    const handleResetColor = async () => {
        if (confirm('確定要重置「顏色預測」模型為預設值嗎？')) {
            await weightAdjustmentEngine.saveWeights(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Title */}
                <div className="flex items-center gap-2 mb-4">
                    <Scale size={20} className="text-emerald-500" />
                    <div>
                        <h2 className="text-lg font-bold text-white leading-none">{t('weights_title')}</h2>
                        <span className="text-xs text-slate-500">{t('weights_subtitle')}</span>
                    </div>
                </div>

                {/* Engine 1: Player Recommendation */}
                <EngineWeightSection
                    title={t('engine_player_title')}
                    desc={t('engine_player_desc')}
                    icon={<BrainCircuit size={16} />}
                    weights={playerWeights as unknown as Record<string, number>}
                    onReset={handleResetPlayer}
                    colorTheme="indigo"
                />

                {/* Engine 2: Count Recommendation */}
                <EngineWeightSection
                    title={t('engine_count_title')}
                    desc={t('engine_count_desc')}
                    icon={<Calculator size={16} />}
                    weights={countWeights as unknown as Record<string, number>}
                    onReset={handleResetCount}
                    colorTheme="amber"
                />

                {/* Engine 3: Location Recommendation */}
                <EngineWeightSection
                    title={t('engine_location_title')}
                    desc={t('engine_location_desc')}
                    icon={<MapPin size={16} />}
                    weights={locationWeights as unknown as Record<string, number>}
                    onReset={handleResetLocation}
                    colorTheme="rose"
                />

                {/* Engine 4: Color Recommendation */}
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

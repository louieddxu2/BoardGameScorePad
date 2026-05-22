import React from 'react';
import { 
    ChevronUp, ChevronDown, List, PenLine, Minus, Users, Plus
} from 'lucide-react';
import { useIntegrationTranslation } from '../../../i18n/integration';

export interface GameLaunchDashboardProps {
    // State
    isAdvancedMode: boolean;
    setIsAdvancedMode: (val: boolean) => void;
    startTimeStr: string;
    setStartTimeStr: (val: string) => void;
    currentModeLabel: string;
    activeMenu: { type: 'mode' | 'location' } | null;
    setActiveMenu: (val: null) => void;
    isManualInput: boolean;
    setIsManualInput: (val: boolean) => void;
    location: string;
    isLocationManual: boolean;
    hasLocationHistory: boolean;
    playerCount: number;
    setPlayerCount: (val: number) => void;
    isPlayerCountManual: boolean;

    // Handlers
    handleTimeClick: (e: React.MouseEvent<HTMLInputElement>) => void;
    openMenu: (type: 'mode' | 'location', e: React.MouseEvent) => void;
    handleLocationChange: (val: string) => void;
    switchToList: (e: React.MouseEvent) => void;
    
    // Refs
    inputRef: React.RefObject<HTMLInputElement>;
}

export const GameLaunchDashboard: React.FC<GameLaunchDashboardProps> = ({
    isAdvancedMode,
    setIsAdvancedMode,
    startTimeStr,
    setStartTimeStr,
    currentModeLabel,
    activeMenu,
    setActiveMenu,
    isManualInput,
    setIsManualInput,
    location,
    isLocationManual,
    hasLocationHistory,
    playerCount,
    setPlayerCount,
    isPlayerCountManual,
    handleTimeClick,
    openMenu,
    handleLocationChange,
    switchToList,
    inputRef
}) => {
    const { t } = useIntegrationTranslation();

    return (
        <>
            {/* Mode Toggle - Anchored Handle */}
            <button
                onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                className={`flex items-center justify-center gap-2 w-full transition-all active:scale-95 shrink-0 mb-1 rounded-lg border shadow-ui-floating z-10
                    ${isAdvancedMode
                        ? 'bg-app-bg-deep text-brand-primary border-brand-primary h-7'
                        : 'bg-app-bg-deep text-txt-muted border-surface-border hover:border-txt-muted h-9'
                    }
                `}
            >
                {isAdvancedMode ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
                {!isAdvancedMode && <span className="text-[11px] font-black uppercase tracking-widest">{t('selector_mode_advanced')}</span>}
            </button>

            {/* 1. Time */}
            <div className="shrink-0">
                <div className="relative w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-center">
                    <input
                        type="time"
                        value={startTimeStr}
                        onClick={handleTimeClick}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="bg-transparent text-txt-primary font-mono font-bold text-sm outline-none w-full text-center p-0 border-none appearance-none"
                    />
                </div>
            </div>

            {/* 2. Mode */}
            <div className="shrink-0 relative">
                <button
                    onClick={(e) => openMenu('mode', e)}
                    className={`w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-between text-txt-primary hover:border-txt-secondary transition-colors
                  ${activeMenu?.type === 'mode' ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : ''}
              `}
                >
                    <div className="flex-1 flex items-center overflow-hidden">
                        <span className="text-sm font-bold truncate">{currentModeLabel}</span>
                    </div>
                    <ChevronUp size={14} className={`text-txt-muted shrink-0 transition-transform ${activeMenu?.type === 'mode' ? 'rotate-180 text-brand-primary' : ''}`} />
                </button>
            </div>

            {/* 3. Location */}
            <div className="shrink-0">
                {isManualInput ? (
                    <div className="relative w-full">
                        <input
                            ref={inputRef}
                            type="search"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            name="loc"
                            value={location}
                            onChange={(e) => handleLocationChange(e.target.value)}
                            placeholder={t('selector_placeholder_location')}
                            className={`w-full bg-app-bg border rounded-lg p-2 pr-7 text-sm text-txt-primary focus:border-brand-primary outline-none placeholder-txt-muted transition-colors
                          ${isLocationManual ? 'border-brand-primary shadow-[0_0_8px_rgb(var(--c-brand-primary)_/_0.15)]' : 'border-surface-border'}
                      `}
                        />
                        {hasLocationHistory && (
                            <button
                                onClick={switchToList}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-txt-muted hover:text-brand-primary transition-colors"
                                title={t('selector_history_location_hint')}
                            >
                                <List size={14} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                if (activeMenu?.type === 'location') {
                                    setIsManualInput(true);
                                    setActiveMenu(null);
                                } else {
                                    openMenu('location', e);
                                }
                            }}
                            className={`w-full flex items-center justify-between bg-app-bg border rounded-lg p-2 text-sm outline-none transition-colors text-left
                          ${activeMenu?.type === 'location'
                                    ? 'border-brand-primary text-brand-primary bg-brand-primary/10 relative z-20'
                                    : (isLocationManual ? 'border-brand-primary text-txt-primary shadow-[0_0_8px_rgb(var(--c-brand-primary)_/_0.15)]' : 'border-surface-border hover:border-txt-secondary text-txt-primary')
                                }
                      `}
                        >
                            {activeMenu?.type === 'location' ? (
                                <span className="flex items-center gap-2 font-bold animate-in fade-in duration-200">
                                    <PenLine size={14} />
                                    {t('selector_new_location')}
                                </span>
                            ) : (
                                <span className={`truncate ${!location ? 'text-txt-muted' : ''}`}>
                                    {location || t('selector_placeholder_location_select')}
                                </span>
                            )}

                            <ChevronUp
                                size={14}
                                className={`shrink-0 ml-1 transition-transform duration-200 ${activeMenu?.type === 'location' ? 'rotate-180 text-brand-primary' : (isLocationManual ? 'text-brand-primary/80' : 'text-txt-muted')}`}
                            />
                        </button>
                    </div>
                )}
            </div>

            {/* 4. Player Count */}
            <div className="shrink-0 flex flex-col justify-center items-center py-1">
                <div
                    className={`flex items-center justify-between w-full bg-app-bg rounded-xl p-1.5 border relative overflow-hidden transition-all duration-300 ${isPlayerCountManual ? 'border-brand-primary shadow-[0_0_10px_rgb(var(--c-brand-primary)_/_0.2)]' : 'border-surface-border'}`}
                >
                    <button
                        onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                        className={`w-9 h-9 flex items-center justify-center bg-surface-bg text-txt-muted rounded-lg active:scale-95 transition-transform hover:bg-surface-bg-alt relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                    >
                        <Minus size={16} />
                    </button>

                    <div className="flex-1 relative h-9 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <Users size={24} className="transition-colors text-txt-muted opacity-40" />
                        </div>
                        <span className={`text-xl font-black font-mono relative z-10 drop-shadow-md transition-colors ${isPlayerCountManual ? 'text-brand-primary' : 'text-txt-primary'}`}>
                            {playerCount}
                        </span>
                    </div>

                    <button
                        onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                        className={`w-9 h-9 flex items-center justify-center bg-brand-primary/10 text-brand-primary rounded-lg active:scale-95 transition-transform border border-brand-primary/20 hover:bg-brand-primary/20 relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};

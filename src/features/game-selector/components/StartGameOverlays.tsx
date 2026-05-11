import React from 'react';
import { Check } from 'lucide-react';
import { ScoringRule, SavedListItem } from '../../../types';

export interface StartGameOverlaysProps {
    activeMenu: { type: 'mode' | 'location', bottom: number, left: number, width: number } | null;
    setActiveMenu: (val: null) => void;
    setIsManualInput: (val: boolean) => void;
    listRef: React.RefObject<HTMLDivElement>;
    SCORING_MODES: { value: ScoringRule, label: string }[];
    scoringRule: ScoringRule;
    setScoringRule: (val: ScoringRule) => void;
    uniqueLocations: SavedListItem[];
    handleLocationSelect: (loc: SavedListItem) => void;
}

export const StartGameOverlays: React.FC<StartGameOverlaysProps> = ({
    activeMenu,
    setActiveMenu,
    setIsManualInput,
    listRef,
    SCORING_MODES,
    scoringRule,
    setScoringRule,
    uniqueLocations,
    handleLocationSelect
}) => {
    if (!activeMenu) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-[60] pointer-events-auto"
                onClick={(e) => {
                    e.stopPropagation();
                    if (activeMenu.type === 'location') setIsManualInput(true);
                    setActiveMenu(null);
                }}
            />
            <div
                ref={listRef}
                className="fixed bg-surface-bg border border-surface-border rounded-xl shadow-ui-floating z-[70] overflow-hidden max-h-[50vh] overflow-y-auto no-scrollbar flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 pointer-events-auto"
                style={{
                    bottom: `${activeMenu.bottom + 8}px`,
                    left: `${activeMenu.left}px`,
                    width: `${activeMenu.width}px`
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {activeMenu.type === 'mode' && [...SCORING_MODES].reverse().map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => { setScoringRule(opt.value); setActiveMenu(null); }}
                        className={`w-full text-left px-3 py-2.5 text-xs font-bold border-b border-surface-border/50 last:border-0 hover:bg-surface-bg-alt flex items-center justify-between ${scoringRule === opt.value ? 'text-brand-primary bg-brand-primary/10' : 'text-txt-primary'}`}
                    >
                        {opt.label}
                        {scoringRule === opt.value && <Check size={12} />}
                    </button>
                ))}

                {activeMenu.type === 'location' && (
                    <>
                        {uniqueLocations.map((loc) => (
                            <button
                                key={loc.id}
                                onClick={() => handleLocationSelect(loc)}
                                className="w-full text-left px-3 py-3 text-xs text-txt-secondary hover:bg-surface-bg-alt hover:text-txt-primary border-b border-surface-border/50 last:border-0 truncate font-medium shrink-0 leading-normal block"
                            >
                                {loc.name}
                            </button>
                        ))}
                    </>
                )}
            </div>
        </>
    );
};

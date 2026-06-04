import React from 'react';
import { ScoringRule, SavedListItem } from '../../../types';
import UpwardSelectMenu from '../../../components/shared/UpwardSelectMenu';

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

    const handleClose = () => {
        if (activeMenu.type === 'location') setIsManualInput(true);
        setActiveMenu(null);
    };

    return (
        <>
            {activeMenu.type === 'mode' && (
                <UpwardSelectMenu
                    anchor={activeMenu}
                    options={[...SCORING_MODES].reverse()}
                    selectedValue={scoringRule}
                    onSelect={(value) => { setScoringRule(value); setActiveMenu(null); }}
                    onClose={handleClose}
                    listRef={listRef}
                />
            )}

            {activeMenu.type === 'location' && (
                <UpwardSelectMenu
                    anchor={activeMenu}
                    options={uniqueLocations.map(loc => ({ value: loc.id, label: loc.name }))}
                    selectedValue=""
                    onSelect={(value) => {
                        const selected = uniqueLocations.find(loc => loc.id === value);
                        if (selected) handleLocationSelect(selected);
                    }}
                    onClose={handleClose}
                    listRef={listRef}
                />
            )}
        </>
    );
};

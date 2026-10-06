import React from 'react';
import { ArrowDown, ArrowUpToLine, Calculator, ListPlus } from 'lucide-react';
import type { Player, QuickAction, ScoreColumn } from '../../../types';
import type { UIState } from '../hooks/useSessionState';
import type { SessionTranslationKey } from '../../../i18n/session';
import NumericKeypad from '../../shared/NumericKeypad';
import QuickButtonPad from '../../shared/QuickButtonPad';
import AutoScorePanel from './AutoScorePanel';
import ScoreInfoPanel from './ScoreInfoPanel';
import { getScoreHistory, getRawValue } from '../../../utils/scoring';
import { getEffectiveIds } from '../../../utils/scoreDisplay';

interface ColumnInputViewOptions {
    player: Player;
    column: ScoreColumn;
    allColumns: ScoreColumn[];
    allPlayers: Player[];
    previewValue: UIState['previewValue'];
    activeFactorIdx: 0 | 1;
    overwriteMode: boolean;
    setPreview: (value: UIState['previewValue']) => void;
    setActiveFactorIdx: (index: 0 | 1) => void;
    setOverwrite: (overwrite: boolean) => void;
    updateScore: (playerId: string, columnId: string, value: UIState['previewValue']) => void;
    moveToNext: () => void;
    t: (key: SessionTranslationKey, params?: Record<string, string | number>) => string;
}

interface ColumnInputView {
    mainContentNode: React.ReactNode;
    sidebarContentNode: React.ReactNode;
    onNextAction: () => void;
    nextButtonContent: React.ReactNode;
}

// Helper for extracting factors from score value
const getFactors = (value: any): [string | number, string | number] => {
    if (value && Array.isArray(value.parts)) return [value.parts[0] ?? 0, value.parts[1] ?? 1];
    if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors)) {
        return [value.factors[0] ?? 0, value.factors[1] ?? 1];
    }
    return [0, 1];
};

// Build the existing layout slots without another component boundary.
// InputPanel keeps ownership of draft state and commit-on-cell-change effects.
export const buildColumnInputView = ({
    player: activePlayer,
    column: activeColumn,
    allColumns,
    allPlayers,
    previewValue,
    activeFactorIdx,
    overwriteMode,
    setPreview,
    setActiveFactorIdx,
    setOverwrite,
    updateScore,
    moveToNext,
    t,
}: ColumnInputViewOptions): ColumnInputView => {
    let mainContentNode: React.ReactNode = null;
    let sidebarContentNode: React.ReactNode = null;
    let onNextAction = () => {};
    let nextButtonContent: React.ReactNode = undefined;

    const isProductMode = activeColumn.formula.includes('×a2');
    const isSumPartsMode = (activeColumn.formula || '').includes('+next');
    const isProductSumPartsMode = isSumPartsMode && isProductMode;
    const constant = activeColumn.constants?.c1 ?? 1;
    const hasMultiplier = constant !== 1;

    const cellScoreObject = activePlayer.scores[activeColumn.id];

    onNextAction = () => {
        moveToNext();
    };

    const handleDeleteLastPart = () => {
        const currentHistory = getScoreHistory(cellScoreObject);
        if (currentHistory.length > 0) {
            const newHistory = currentHistory.slice(0, -1);
            const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
            updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
        }
    };

    const handleQuickButtonAction = (action: QuickAction) => {
        if (isProductSumPartsMode) {
            let currentFactors = [0, 1];
            if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                currentFactors = previewValue.factors.slice();
            }

            if (activeFactorIdx === 0) {
                currentFactors[0] = action.value;
                setPreview({ factors: currentFactors });
                setActiveFactorIdx(1);
                setOverwrite(true);
            } else {
                const n1 = parseFloat(String(currentFactors[0])) || 0;
                const n2 = action.value;
                const product = n1 * n2;

                const currentHistory = getScoreHistory(cellScoreObject);
                const newHistory = [...currentHistory, String(product)];
                const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });

                setPreview({ factors: [0, 1] });
                setActiveFactorIdx(0);
                setOverwrite(true);
            }
        } else if (isSumPartsMode) {
            const currentHistory = getScoreHistory(cellScoreObject);
            let newHistory = [...currentHistory];
            const valToAdd = hasMultiplier ? action.value * constant : action.value;

            if (action.isModifier && newHistory.length > 0) {
                newHistory[newHistory.length - 1] = String(parseFloat(newHistory[newHistory.length - 1]) + valToAdd);
            } else {
                newHistory.push(String(valToAdd));
            }
            const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
            updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
        } else {
            // Priority 1: Multi-select Toggle Logic
            if (activeColumn.isMultiSelect) {
                const currentIds = cellScoreObject?.multiOptionIds || [];
                const isSelected = currentIds.includes(action.id);
                const newIds = isSelected
                    ? currentIds.filter(id => id !== action.id)
                    : [...currentIds, action.id];

                updateScore(activePlayer.id, activeColumn.id, { multiOptionIds: newIds });
            }
            // Priority 2: Standard Single-select
            else {
                updateScore(activePlayer.id, activeColumn.id, { optionId: action.id });
            }
        }
    };

    if (activeColumn.inputType === 'auto') {
        mainContentNode = (
            <div className="flex-1 min-h-0 flex items-center justify-center bg-surface-recessed/50 rounded-xl border border-surface-border p-4">
                <AutoScorePanel
                    column={activeColumn}
                    player={activePlayer}
                    allColumns={allColumns}
                    allPlayers={allPlayers}
                />
            </div>
        );
        sidebarContentNode = (
            <div className="flex flex-col flex-1 min-h-0 p-2 text-txt-secondary text-xs">
                <div className="flex items-center gap-1 text-[10px] text-txt-muted font-bold uppercase pb-1 border-b border-surface-border shrink-0">
                    <Calculator size={12} /> {t('input_auto_calc')}
                </div>
                <div className="flex-1 overflow-y-auto pt-2 space-y-2">
                    <p>{t('input_auto_desc')}</p>
                </div>
            </div>
        );
    } else if (activeColumn.inputType === 'clicker') {
        const effectiveIds = getEffectiveIds(activeColumn, cellScoreObject);
        const currentOptionId = !activeColumn.isMultiSelect ? effectiveIds[0] : undefined;
        const currentMultiOptionIds = activeColumn.isMultiSelect ? effectiveIds : undefined;

        mainContentNode = (
            <QuickButtonPad
                column={activeColumn}
                onAction={handleQuickButtonAction}
                currentOptionId={currentOptionId}
                currentMultiOptionIds={currentMultiOptionIds}
            />
        );

        if (isProductSumPartsMode) {
            sidebarContentNode = <ScoreInfoPanel
                column={activeColumn}
                value={cellScoreObject}
                activeFactorIdx={activeFactorIdx}
                setActiveFactorIdx={setActiveFactorIdx}
                localKeypadValue={previewValue}
                onDeleteLastPart={handleDeleteLastPart}
                setOverwrite={setOverwrite}
            />;
        } else if (isSumPartsMode) {
            sidebarContentNode = <ScoreInfoPanel column={activeColumn} value={cellScoreObject} onDeleteLastPart={handleDeleteLastPart} />;
        } else {
            sidebarContentNode = (<div className="flex flex-col flex-1 min-h-0 p-2 text-txt-secondary text-xs"><div className="flex items-center gap-1 text-[10px] text-txt-muted font-bold uppercase pb-1 border-b border-surface-border shrink-0"><ListPlus size={12} /> {t('input_list_menu')}</div><div className="flex-1"></div></div>);
        }
    } else {
        if (isSumPartsMode) {
            if (isProductSumPartsMode) {
                let currentFactors = [0, 1];
                if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                    currentFactors = previewValue.factors;
                }
                const n1 = parseFloat(String(currentFactors[0])) || 0;

                if (n1 !== 0) {
                    if (activeFactorIdx === 0) {
                        nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">{t('input_btn_enter')} {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
                        onNextAction = () => {
                            setActiveFactorIdx(1);
                            setOverwrite(true);
                        };
                    } else {
                        nextButtonContent = <ArrowUpToLine size={28} />;
                        onNextAction = () => {
                            const product = (parseFloat(String(currentFactors[0])) || 0) * (parseFloat(String(currentFactors[1])) || 0);
                            if (product !== 0 || n1 !== 0) {
                                const currentHistory = getScoreHistory(cellScoreObject);
                                const newHistory = [...currentHistory, String(product)];
                                const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                                updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });

                                setPreview({ factors: [0, 1] });
                                setActiveFactorIdx(0);
                                setOverwrite(true);
                            } else {
                                moveToNext();
                            }
                        };
                    }
                }
            } else {
                const inputPart = parseFloat(String(getRawValue(previewValue))) || 0;
                if (inputPart !== 0) nextButtonContent = <ArrowUpToLine size={28} />;

                onNextAction = () => {
                    const input = parseFloat(String(getRawValue(previewValue))) || 0;
                    if (input !== 0) {
                        const valToAdd = hasMultiplier ? input * constant : input;
                        const currentHistory = getScoreHistory(cellScoreObject);
                        const newHistory = [...currentHistory, String(valToAdd)];
                        const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                        updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                        setPreview(0);
                        setOverwrite(true);
                    } else {
                        moveToNext();
                    }
                };
            }
        } else if (isProductMode) {
            const n1 = parseFloat(String(getFactors(previewValue)[0])) || 0;
            if (n1 !== 0 && activeFactorIdx === 0) {
                nextButtonContent = (<div className="flex flex-col items-center leading-none"><span className="text-xs">{t('input_btn_enter')} {activeColumn.subUnits?.[1] || 'B'}</span><ArrowDown size={16} /></div>);
                onNextAction = () => {
                    setActiveFactorIdx(1);
                    setOverwrite(true);
                }
            }
        }

        // [Updated] Always pass previewValue to keypad to enable real-time reflection of input
        const keypadValue = previewValue;

        mainContentNode = <NumericKeypad
            value={keypadValue}
            onChange={(val: any) => {
                setPreview(val);
                // [Fix] In Standard/Product Mode, we update DB immediately for "Real-time" feel
                if (!isSumPartsMode) {
                    updateScore(activePlayer.id, activeColumn.id, val);
                }
            }}
            column={activeColumn} overwrite={overwriteMode} setOverwrite={setOverwrite}
            onNext={onNextAction} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx} playerId={activePlayer.id}
        />;

        sidebarContentNode = <ScoreInfoPanel
            column={activeColumn} value={cellScoreObject} activeFactorIdx={activeFactorIdx} setActiveFactorIdx={setActiveFactorIdx}
            localKeypadValue={previewValue}
            onDeleteLastPart={isSumPartsMode ? handleDeleteLastPart : undefined}
            setOverwrite={setOverwrite}
        />;
    }

    return { mainContentNode, sidebarContentNode, onNextAction, nextButtonContent };
};

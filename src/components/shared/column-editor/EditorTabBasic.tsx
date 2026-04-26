
import React, { useEffect } from 'react';
import { ScoreColumn, InputMethod } from '../../../types';
import { Calculator, Hash, Plus, X as Multiply, Square } from 'lucide-react';
import QuickActionsEditor from './QuickActionsEditor';
import { useColumnEditorTranslation } from '../../../i18n/column_editor'; // Changed Import

interface EditorTabBasicProps {
    column: ScoreColumn;
    onChange: (updates: Partial<ScoreColumn>) => void;
    cachedSumPartsInputType: InputMethod;
    onUpdateCachedSumPartsInputType: (type: InputMethod) => void;
}

type CalculationMode = 'standard' | 'product';

// 更清晰的 Key 名稱
const PREF_KEY_STD_UNIT = 'sm_pref_standard_unit';
const PREF_KEY_PROD_UNIT_A = 'sm_pref_product_unit_a';
const PREF_KEY_PROD_UNIT_B = 'sm_pref_product_unit_b';

// Extracted Sub-Settings Component for reusability
const SumPartsSubSettings: React.FC<{
    column: ScoreColumn,
    onChange: (updates: Partial<ScoreColumn>) => void,
    themeColor?: 'emerald' | 'indigo',
    isProductMode?: boolean
}> = ({ column, onChange, themeColor = 'emerald', isProductMode = false }) => {
    const { t } = useColumnEditorTranslation(); // Use New Hook
    const activeSwitchClass = themeColor === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';

    // Normalize logic for undefined (default is true)
    const currentMode = column.showPartsInGrid === undefined ? true : column.showPartsInGrid;

    return (
        <>
            <div className="space-y-2">
                <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('col_display_in_grid')}</label>
                <div className="flex bg-modal-bg-elevated rounded-lg p-1 border border-surface-border">
                    <button onClick={() => onChange({ showPartsInGrid: true })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === true ? 'bg-brand-secondary text-white shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                        {t('col_display_std')}
                    </button>
                    <button onClick={() => onChange({ showPartsInGrid: false })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === false ? 'bg-brand-secondary text-white shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                        {t('col_display_total')}
                    </button>
                    <button onClick={() => onChange({ showPartsInGrid: 'parts_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === 'parts_only' ? 'bg-brand-secondary text-white shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                        {t('col_display_parts')}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('col_input_method')}</label>
                <div className={`flex items-center justify-between bg-modal-bg-elevated p-3 rounded-xl border border-surface-border cursor-pointer hover:bg-surface-hover transition-colors`} onClick={() => onChange({ inputType: column.inputType === 'clicker' ? 'keypad' : 'clicker' })}>
                    <span className="text-sm font-bold text-txt-primary">{t('col_use_pad')}</span>
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${column.inputType === 'clicker' ? activeSwitchClass : 'bg-modal-bg-recessed'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${column.inputType === 'clicker' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </div>
                {column.inputType === 'clicker' && (
                    <div className="bg-modal-bg/50 p-4 rounded-xl border border-surface-border space-y-4 mt-2">
                        <QuickActionsEditor
                            quickActions={column.quickActions || []}
                            buttonGridColumns={column.buttonGridColumns}
                            defaultColor={column.color}
                            showModifierToggle={!isProductMode}
                            onChange={onChange}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

const ToggleSwitch = ({ checked, onChange, label, themeColor = 'emerald' }: { checked: boolean, onChange: () => void, label: string, themeColor?: 'emerald' | 'indigo' }) => {
    const activeClass = themeColor === 'emerald' ? 'bg-brand-primary/10 border-brand-primary/40 shadow-sm' : 'bg-brand-secondary/10 border-brand-secondary/40 shadow-sm';
    const activeTextClass = themeColor === 'emerald' ? 'text-brand-primary' : 'text-brand-secondary';
    const activeKnobClass = themeColor === 'emerald' ? 'bg-brand-primary' : 'bg-brand-secondary';

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onChange();
            }}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-300 ${checked ? activeClass : 'bg-modal-bg-elevated border-surface-border hover:bg-surface-hover'}`}
        >
            <span className={`text-sm font-bold transition-colors ${checked ? activeTextClass : 'text-txt-primary'}`}>{label}</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? activeKnobClass : 'bg-modal-bg-recessed'}`}>
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
        </div>
    );
};

const EditorTabBasic: React.FC<EditorTabBasicProps> = ({ column, onChange, cachedSumPartsInputType, onUpdateCachedSumPartsInputType }) => {
    const { t } = useColumnEditorTranslation(); // Use New Hook

    // Logic to determine current mode from formula
    const getCalculationMode = (formula: string): CalculationMode => {
        if (formula.includes('×a2')) return 'product';
        return 'standard';
    };

    const currentCalcMode = getCalculationMode(column.formula);
    const isSumPartsEnabled = (column.formula || '').includes('+next');

    // Sync current input type to cache when in sum-parts mode
    useEffect(() => {
        if (isSumPartsEnabled) {
            onUpdateCachedSumPartsInputType(column.inputType === 'auto' ? 'keypad' : (column.inputType || 'keypad'));
        }
    }, [isSumPartsEnabled, column.inputType, onUpdateCachedSumPartsInputType]);


    const setCalculationMode = (mode: CalculationMode) => {
        // Determine the state of Sum Parts BEFORE switch to preserve it
        const willEnableSumParts = isSumPartsEnabled;

        if (mode === 'product') {
            // Switch to Product
            // If Sum Parts was enabled, use the sum-product formula, otherwise simple product
            const newFormula = willEnableSumParts ? '(a1×a2)+next' : 'a1×a2';

            let updates: Partial<ScoreColumn> = { formula: newFormula };

            // Initialize subUnits if missing
            if (!column.subUnits || column.subUnits.length !== 2) {
                // Priority: LocalStorage Pref -> Default i18n
                const prefA = localStorage.getItem(PREF_KEY_PROD_UNIT_A) || t('col_default_unit_qty');
                const prefB = localStorage.getItem(PREF_KEY_PROD_UNIT_B) || t('col_default_unit_pts');
                updates.subUnits = [prefA, prefB];
            }

            // CRITICAL: Do NOT reset inputType if Sum Parts is enabled. 
            // If Sum Parts is disabled, Product mode defaults to Keypad.
            if (willEnableSumParts) {
                updates.inputType = (column.inputType !== 'auto' ? column.inputType : null) || cachedSumPartsInputType;
            } else {
                updates.inputType = 'keypad';
            }

            onChange(updates);
        } else {
            // Switch to Standard
            const weight = column.constants?.c1 ?? 1;
            let newFormula = '';

            if (willEnableSumParts) {
                // New logic: (a1×c1)+next pattern
                newFormula = weight !== 1 ? '(a1×c1)+next' : 'a1+next';
            } else {
                // a1×c1 pattern
                newFormula = weight !== 1 ? 'a1×c1' : 'a1';
            }

            let updates: Partial<ScoreColumn> = { formula: newFormula };

            // CRITICAL: Do NOT reset inputType if Sum Parts is enabled.
            if (!willEnableSumParts) {
                updates.inputType = 'keypad';
            }

            onChange(updates);
        }
    };

    const toggleSumParts = () => {
        if (currentCalcMode === 'product') {
            // Product Mode Toggle
            if (!isSumPartsEnabled) {
                // Enable: (a1×a2)+next
                onChange({
                    formula: '(a1×a2)+next',
                    inputType: cachedSumPartsInputType // Restore preference
                });
            } else {
                // Disable: a1×a2
                onChange({
                    formula: 'a1×a2',
                    inputType: 'keypad' // Reset to keypad (standard product input)
                });
            }
        } else {
            // Standard Mode Toggle
            const weight = column.constants?.c1 ?? 1;
            let newFormula = '';

            if (!isSumPartsEnabled) {
                // Enable: (a1×c1)+next pattern if weight exists
                newFormula = weight !== 1 ? '(a1×c1)+next' : 'a1+next';
                onChange({
                    formula: newFormula,
                    inputType: cachedSumPartsInputType // Restore cached preference
                });
            } else {
                // Disable
                newFormula = weight !== 1 ? 'a1×c1' : 'a1';
                onChange({
                    formula: newFormula,
                    inputType: 'keypad' // Standard is usually keypad
                });
            }
        }
    };

    const updateMultiplier = (val: any) => {
        let num = 1;
        if (typeof val === 'string') {
            if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                onChange({ constants: { ...column.constants, c1: val as any } });
                return;
            }
            num = parseFloat(val);
        } else {
            num = val;
        }

        if (isNaN(num)) return;

        // Update c1 and keep the formula structure synced
        const newC1 = num;
        let newFormula = '';

        if (isSumPartsEnabled) {
            // New logic: (a1×c1)+next pattern
            newFormula = newC1 !== 1 ? '(a1×c1)+next' : 'a1+next';
        } else {
            newFormula = newC1 !== 1 ? 'a1×c1' : 'a1';
        }

        onChange({
            constants: { ...column.constants, c1: newC1 },
            formula: newFormula
        });
    };

    const isRoundingEnabled = !!column.rounding && column.rounding !== 'none';

    const toggleRounding = () => {
        onChange({ rounding: isRoundingEnabled ? 'none' : 'round' });
    };

    // Wrapper for sub-settings change to cache input type
    const handleSubSettingsChange = (updates: Partial<ScoreColumn>) => {
        onChange(updates);
        if (updates.inputType) {
            onUpdateCachedSumPartsInputType(updates.inputType);
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-200 pb-10">
            {/* Mode Switcher */}
            <div>
                <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('input_calc_mode')}</label>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCalculationMode('standard')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${currentCalcMode === 'standard' ? 'bg-brand-primary/10 border-brand-primary/50 text-brand-primary shadow-sm' : 'bg-modal-bg-elevated border-surface-border text-txt-secondary hover:bg-surface-hover hover:border-surface-border-hover'}`}>
                        <Calculator size={24} />
                        <div className="leading-tight text-center">
                            <div className="text-xs font-black uppercase">{t('col_mode_std')}</div>
                            <div className="text-[10px] font-bold opacity-60">{t('col_mode_std_desc')}</div>
                        </div>
                    </button>
                    <button onClick={() => setCalculationMode('product')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${currentCalcMode === 'product' ? 'bg-brand-secondary/10 border-brand-secondary/50 text-brand-secondary shadow-sm' : 'bg-modal-bg-elevated border-surface-border text-txt-secondary hover:bg-surface-hover hover:border-surface-border-hover'}`}>
                        <div className="flex items-center gap-0.5 h-[24px]">
                            <Square size={16} strokeWidth={2.5} />
                            <Multiply size={10} strokeWidth={3} />
                            <Square size={16} strokeWidth={2.5} />
                        </div>
                        <div className="leading-tight text-center">
                            <div className="text-xs font-black uppercase">{t('col_mode_prod')}</div>
                            <div className="text-[10px] font-bold opacity-60"> {t('col_mode_prod_desc')}</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Base Config Block - Content Depends on Mode */}
            {currentCalcMode === 'standard' && (
                <div className="p-5 rounded-2xl border border-surface-border bg-modal-bg-elevated shadow-sm space-y-4 border-l-4 border-l-brand-primary">
                    <div>
                        <label className="block text-xs font-bold text-txt-muted uppercase mb-1">{t('col_unit')}</label>
                        <input
                            type="text"
                            value={column.unit || ''}
                            onChange={e => {
                                onChange({ unit: e.target.value });
                            }}
                            onFocus={e => e.target.select()}
                            placeholder={t('col_unit')}
                            className="w-full bg-modal-bg border border-surface-border rounded-xl p-3 text-txt-primary font-black focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all placeholder-txt-muted/50 shadow-sm"
                        />
                    </div>
                    <div className="bg-modal-bg border border-surface-border/50 p-4 rounded-xl flex items-center justify-center gap-3 shadow-inner">
                        <span className="text-txt-secondary text-sm">{t('col_input_val')}</span>
                        <span className="text-txt-muted">×</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={column.constants?.c1 ?? 1}
                            onChange={e => updateMultiplier(e.target.value)}
                            onFocus={e => e.target.select()}
                            className="w-20 bg-modal-bg border-2 border-brand-primary text-brand-primary text-center font-black p-2 rounded-lg outline-none shadow-sm shadow-brand-primary/10 focus:ring-4 focus:ring-brand-primary/10 transition-all"
                        />
                        {isSumPartsEnabled ? (
                            <>
                                <span className="text-txt-muted font-bold px-1"><Plus size={14} /></span>
                                <span className="text-txt-secondary text-sm">...</span>
                            </>
                        ) : null}
                        <span className="text-txt-muted">=</span>
                        <span className="text-txt-primary font-bold">{t('col_score')}</span>
                    </div>
                </div>
            )}

            {currentCalcMode === 'product' && (
                <div className="p-5 rounded-2xl border border-surface-border bg-modal-bg-elevated shadow-sm space-y-4 border-l-4 border-l-brand-secondary">
                    <div>
                        <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('col_prod_unit_title')}</label>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                                <label className="block text-[10px] text-txt-secondary mb-1 truncate" title={t('col_prod_unit_a')}> {t('col_prod_unit_a')}</label>
                                <input
                                    type="text"
                                    value={column.subUnits?.[0] || ''}
                                    onChange={e => {
                                        onChange({ subUnits: [e.target.value, column.subUnits?.[1] || ''] });
                                    }}
                                    onFocus={e => e.target.select()}
                                    className="w-full bg-modal-bg border border-surface-border rounded-xl p-3 text-txt-primary font-black text-center focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/10 outline-none transition-all placeholder:text-txt-muted/50 shadow-sm"
                                />
                            </div>

                            {isSumPartsEnabled && (
                                <div className="pb-2 text-txt-muted font-bold">×</div>
                            )}

                            <div className="flex-1 min-w-0">
                                <label className="block text-[10px] text-txt-secondary mb-1 truncate" title={t('col_prod_unit_b')}> {t('col_prod_unit_b')}</label>
                                <input
                                    type="text"
                                    value={column.subUnits?.[1] || ''}
                                    onChange={e => {
                                        onChange({ subUnits: [column.subUnits?.[0] || '', e.target.value] });
                                    }}
                                    onFocus={e => e.target.select()}
                                    className="w-full bg-modal-bg-recessed border border-surface-border rounded-xl p-3 text-txt-primary font-black text-center focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/10 outline-none transition-all placeholder:text-txt-muted/50"
                                />
                            </div>

                            {isSumPartsEnabled && (
                                <>
                                    <div className="pb-2 text-txt-muted font-bold">=</div>
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-[10px] text-txt-secondary mb-1 truncate" title={t('col_unit')}> {t('col_unit')}</label>
                                        <input
                                            type="text"
                                            value={column.unit || ''}
                                            onChange={e => onChange({ unit: e.target.value })}
                                            onFocus={e => e.target.select()}
                                            className="w-full bg-modal-bg-recessed border border-surface-border rounded-xl p-3 text-txt-primary font-black text-center focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/10 outline-none transition-all placeholder:text-txt-muted/50"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-modal-bg border border-surface-border p-4 rounded-xl flex items-center justify-center gap-2">
                        <span className="text-txt-secondary text-sm">A</span>
                        <span className="text-brand-primary font-bold"><Multiply size={10} /></span>
                        <span className="text-txt-secondary text-sm">B</span>
                        {isSumPartsEnabled && (
                            <>
                                <span className="text-txt-muted font-bold px-1"><Plus size={14} /></span>
                                <span className="text-txt-secondary text-sm">...</span>
                            </>
                        )}
                        <span className="text-txt-muted">=</span>
                        <span className="text-txt-primary font-bold">{t('col_score')}</span>
                    </div>
                </div>
            )}

            {/* Sum Parts Toggle & Settings - Shared & Synchronized */}
            <div>
                <ToggleSwitch
                    checked={isSumPartsEnabled}
                    onChange={toggleSumParts}
                    label={t('col_sum_parts')}
                    themeColor={currentCalcMode === 'product' ? 'indigo' : 'emerald'}
                />

                {isSumPartsEnabled && (
                    <div className={`pt-4 pl-4 ml-4 border-l-2 space-y-4 animate-in fade-in slide-in-from-top-2 ${currentCalcMode === 'product' ? 'border-brand-secondary' : 'border-brand-primary'}`}>
                        <SumPartsSubSettings
                            column={column}
                            onChange={handleSubSettingsChange}
                            themeColor={currentCalcMode === 'product' ? 'indigo' : 'emerald'}
                            isProductMode={currentCalcMode === 'product'}
                        />
                    </div>
                )}
            </div>

            {/* Rounding Options */}
            <div className="space-y-2 pt-4 border-t border-surface-border">
                <ToggleSwitch
                    checked={isRoundingEnabled}
                    onChange={toggleRounding}
                    label={t('col_rounding_enable')}
                    themeColor="indigo"
                />
                {isRoundingEnabled && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-4 pl-4 border-l-2 border-brand-secondary ml-4">
                        <div className="grid grid-cols-3 gap-2">
                            {(['floor', 'ceil', 'round'] as const).map(mode => (
                                <button key={mode} onClick={() => onChange({ rounding: mode })} className={`py-2 px-1 rounded-lg border text-xs font-bold ${column.rounding === mode ? 'bg-brand-secondary border-brand-secondary text-white' : 'bg-modal-bg-elevated border-surface-border text-txt-secondary'}`}>
                                    {mode === 'floor' ? t('col_round_floor') : mode === 'ceil' ? t('col_round_ceil') : t('col_round_round')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorTabBasic;

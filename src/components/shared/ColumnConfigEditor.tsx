
import React, { useState, useEffect, useRef } from 'react';
import { ScoreColumn, InputMethod, MappingRule } from '../../types';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Trash2, Crop, LayoutList, Layers, Sigma, Sparkles, Settings2, Info, EyeOff, Users } from 'lucide-react';
import { COLORS } from '../../colors';
import { isColorDark } from '../../utils/ui';
import { useKeyboardStatus } from '../../hooks/useVisualViewportOffset';
import { useConfirm } from '../../hooks/useConfirm';
import LayoutEditor from './LayoutEditor';
import EditorTabMapping from './column-editor/EditorTabMapping';
import EditorTabSelection from './column-editor/EditorTabSelection';
import EditorTabBasic from './column-editor/EditorTabBasic';
import EditorTabAuto from './column-editor/EditorTabAuto';
import { extractIdentifiers } from '../../utils/formulaEvaluator';
import { useColumnEditorTranslation } from '../../i18n/column_editor'; // Changed Import
import { useCommonTranslation } from '../../i18n/common';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';

interface ColumnConfigEditorProps {
    column: ScoreColumn;
    allColumns?: ScoreColumn[];
    onSave: (updates: Partial<ScoreColumn>) => void;
    onDelete: () => void;
    onDeleteAll?: () => void;
    onClose: () => void;
    baseImage?: string;
}

type EditorTab = 'basic' | 'mapping' | 'select' | 'auto';
type CalculationMode = 'standard' | 'product';

const PREF_KEY_STD_UNIT = 'sm_pref_standard_unit';
const PREF_KEY_PROD_UNIT_A = 'sm_pref_product_unit_a';
const PREF_KEY_PROD_UNIT_B = 'sm_pref_product_unit_b';
const PREF_KEY_ADV_OPEN = 'sm_pref_editor_adv';
const PLAYER_COUNT_ID = '__PLAYER_COUNT__';

// [Stable] 外部化 TabButton，避免每次渲染重新建立元件導致桌面版事件失效
const TabButton = ({ id, activeTab, setActiveTab, label, icon: Icon, isSpecial }: {
    id: EditorTab,
    activeTab: EditorTab,
    setActiveTab: (id: EditorTab) => void,
    label: string,
    icon: any,
    isSpecial?: boolean
}) => {
    const isActive = activeTab === id;
    const colorClass = isSpecial ? 'text-brand-secondary' : 'text-brand-primary';
    const borderClass = isSpecial ? 'border-brand-secondary' : 'border-brand-primary';

    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                flex-1 py-2.5 flex flex-col items-center justify-center gap-1 transition-all border-b-2 
                ${isActive 
                    ? `bg-modal-bg-recessed ${colorClass} ${borderClass} font-black` 
                    : 'bg-transparent text-txt-muted border-transparent hover:text-txt-primary'
                }
            `}
        >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
        </button>
    );
};

const ColumnConfigEditor: React.FC<ColumnConfigEditorProps> = ({ column, allColumns = [], onSave, onDelete, onClose, baseImage }) => {
    const { t } = useColumnEditorTranslation(); // Use New Hook
    const { t: tCommon } = useCommonTranslation();
    const { confirm } = useConfirm();

    const getInitialState = (): ScoreColumn => {
        // 關鍵修改：初始化時整合 functions 結構
        const functions: Record<string, MappingRule[]> = column.functions ? { ...column.functions } : {};

        // 如果有舊版的 f1 但 functions 裡沒定義 f1，則進行遷移
        if (column.f1 && column.f1.length > 0 && !functions.f1) {
            functions.f1 = [...column.f1];
        }

        // 確保所有規則的 unitScore 有初始化
        Object.keys(functions).forEach(fKey => {
            functions[fKey] = functions[fKey].map(r =>
                r.isLinear && r.unitScore === undefined ? { ...r, unitScore: r.score } : r
            );
        });

        let displayMode = column.displayMode || 'row';
        let isScoring = column.isScoring ?? true;

        return {
            ...column,
            functions,
            f1: functions.f1, // 同步保留 f1 以相容舊版計算邏輯
            displayMode,
            isScoring
        };
    };

    const [editedCol, setEditedCol] = useState<ScoreColumn>(getInitialState);
    const initialStringifiedRef = useRef(JSON.stringify(getInitialState()));

    const sumPartsInputTypeCache = useRef<InputMethod>(
        (editedCol.formula || '').includes('+next')
            ? ((editedCol.inputType !== 'auto' ? editedCol.inputType : null) || 'keypad')
            : 'keypad'
    );

    const getInitialTab = (col: ScoreColumn): EditorTab => {
        if (col.inputType === 'auto') return 'auto';
        const formula = col.formula || '';
        if (formula.startsWith('f1')) return 'mapping';
        if (col.inputType === 'clicker' && !formula.includes('+next')) return 'select';
        return 'basic';
    };

    const [activeTab, setActiveTab] = useState<EditorTab>(() => getInitialTab(editedCol));

    const [showLayoutEditor, setShowLayoutEditor] = useState(false);

    // Advanced Settings State
    const [showAdvanced, setShowAdvanced] = useState(() => localStorage.getItem(PREF_KEY_ADV_OPEN) === 'true');
    const [helpText, setHelpText] = useState('col_help_default');

    useEffect(() => {
        localStorage.setItem(PREF_KEY_ADV_OPEN, String(showAdvanced));
    }, [showAdvanced]);

    const nameTextareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const textarea = nameTextareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [editedCol.name]);

    const { isKeyboardOpen, offset } = useKeyboardStatus();

    const hasUnsavedChanges = () => JSON.stringify(editedCol) !== initialStringifiedRef.current;

    const handleAttemptClose = async () => {
        if (hasUnsavedChanges()) {
            const agreed = await confirm({
                title: t('col_discard_title'),
                message: t('col_discard_msg'),
                confirmText: t('col_discard_confirm'),
                cancelText: t('col_discard_cancel'),
                isDangerous: true
            });
            if (agreed) onClose();
        } else {
            onClose();
        }
    };

    // [Stable Refactor]
    // 延遲 100ms 啟動 Back Handler，確保跳過掛載時可能殘留的 popstate 事件 (解決「開了秒關」問題)
    const [isHandlerActive, setIsHandlerActive] = useState(false);
    useEffect(() => {
        if (column) {
            const timer = setTimeout(() => setIsHandlerActive(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsHandlerActive(false);
        }
    }, [column]);

    useModalBackHandler(isHandlerActive, () => {
        if (showLayoutEditor) {
            setShowLayoutEditor(false);
        } else {
            handleAttemptClose();
        }
    }, 'col-config-editor');

    const getCalculationMode = (formula: string): CalculationMode => {
        if (formula.includes('×a2')) return 'product';
        // Now sum-parts is considered part of standard
        return 'standard';
    };

    const handleSave = () => {
        let finalUpdates: Partial<ScoreColumn> = { ...editedCol };

        if (activeTab === 'auto') {
            finalUpdates.inputType = 'auto';
            finalUpdates.isAuto = true;
            delete finalUpdates.constants;

            // [AUTO COMPLETE LOGIC]
            // If the user typed a formula but didn't lock/parse it manually, we do it here.
            if (finalUpdates.formula && finalUpdates.formula.trim()) {
                const { vars, funcs } = extractIdentifiers(finalUpdates.formula);
                const availableColumns = allColumns.filter(c => c.id !== column.id);

                // 1. Fill missing variable maps
                const currentVarMap = (finalUpdates.variableMap || {}) as Record<string, any>;
                const newVariableMap: typeof currentVarMap = {};

                vars.forEach(v => {
                    if (currentVarMap[v]) {
                        newVariableMap[v] = currentVarMap[v];
                    } else {
                        newVariableMap[v] = availableColumns[0]
                            ? { id: availableColumns[0].id, name: availableColumns[0].name, mode: 'value' }
                            : { id: PLAYER_COUNT_ID, name: t('col_auto_player_count'), mode: 'value' };
                    }
                });
                finalUpdates.variableMap = newVariableMap;

                // 2. Fill missing functions
                const currentFunctions = finalUpdates.functions || {};
                const newFunctions: Record<string, MappingRule[]> = {};

                funcs.forEach(fKey => {
                    if (currentFunctions[fKey]) {
                        newFunctions[fKey] = currentFunctions[fKey];
                    } else {
                        newFunctions[fKey] = [{ min: 0, score: 0 }];
                    }
                });
                finalUpdates.functions = newFunctions;
            }

            // [BUG FIX] Ensure functions is preserved and f1 is synced
            if (finalUpdates.functions) {
                // Also explicitly delete top-level f1 if it's not in functions, to avoid ambiguity
                if (finalUpdates.functions.f1) {
                    finalUpdates.f1 = finalUpdates.functions.f1;
                } else {
                    finalUpdates.f1 = undefined;
                }
            } else {
                // Should theoretically not happen in auto tab if setup correctly, but as fallback
                finalUpdates.f1 = undefined;
            }

        } else if (activeTab === 'mapping') {
            finalUpdates.formula = 'f1(a1)';
            finalUpdates.isAuto = false;
            if (!finalUpdates.f1 || finalUpdates.f1.length === 0) finalUpdates.f1 = [{ min: 0, score: 0 }];
            finalUpdates.inputType = 'keypad';
            // Ensure f1 is also in functions for consistency
            finalUpdates.functions = { f1: finalUpdates.f1 };
            delete finalUpdates.constants;
        } else if (activeTab === 'select') {
            finalUpdates.formula = 'a1';
            finalUpdates.isAuto = false;
            finalUpdates.inputType = 'clicker';
            delete finalUpdates.f1;
            delete finalUpdates.functions;
            delete finalUpdates.constants;
        } else {
            // Standard / Product / Sum Parts
            const currentMode = getCalculationMode(editedCol.formula);
            finalUpdates.isAuto = false;

            if (currentMode === 'product') {
                // Check if sum-parts is enabled in the edited column
                const isSumParts = (editedCol.formula || '').includes('+next');
                if (isSumParts) {
                    finalUpdates.formula = '(a1×a2)+next';
                    // Preserve current input settings (allows clicker/keypad), ensure not 'auto'
                    finalUpdates.inputType = (editedCol.inputType !== 'auto' ? editedCol.inputType : null) || 'keypad';
                } else {
                    finalUpdates.formula = 'a1×a2';
                    finalUpdates.inputType = 'keypad';
                }
            } else {
                // Handle Standard (which now includes Sum Parts)
                // We construct formula based on whether +next was enabled and c1
                const isSumParts = (editedCol.formula || '').includes('+next');
                const weight = finalUpdates.constants?.c1 ?? 1;

                let f = 'a1';
                if (isSumParts) {
                    // If Sum Parts is enabled:
                    // 1x weight: a1+next
                    // >1x weight: (a1+next)×c1  <-- Parenthesis format
                    f = weight !== 1 ? '(a1+next)×c1' : 'a1+next';
                    // Filter out 'auto' from previous tab
                    finalUpdates.inputType = (editedCol.inputType !== 'auto' ? editedCol.inputType : null) || sumPartsInputTypeCache.current || 'keypad';
                } else {
                    // Standard: a1 or a1×c1
                    f = weight !== 1 ? 'a1×c1' : 'a1';
                    finalUpdates.inputType = 'keypad';
                }

                finalUpdates.formula = f;
            }
            delete finalUpdates.f1;
            delete finalUpdates.functions;
        }

        if (activeTab === 'basic') {
            if (getCalculationMode(finalUpdates.formula || '') === 'product') {
                if (finalUpdates.subUnits && finalUpdates.subUnits.length === 2) {
                    localStorage.setItem(PREF_KEY_PROD_UNIT_A, finalUpdates.subUnits[0] || '');
                    localStorage.setItem(PREF_KEY_PROD_UNIT_B, finalUpdates.subUnits[1] || '');
                }
            } else {
                localStorage.setItem(PREF_KEY_STD_UNIT, finalUpdates.unit || '');
            }
        } else if (activeTab === 'mapping') {
            localStorage.setItem(PREF_KEY_STD_UNIT, finalUpdates.unit || '');
        }

        // [CRITICAL] 安全保險絲：只要分頁不是 'auto' 且 inputType 仍殘留 'auto'，強制修正
        if (activeTab !== 'auto' && finalUpdates.inputType === 'auto') {
            finalUpdates.inputType = sumPartsInputTypeCache.current || 'keypad';
        }

        onSave(finalUpdates);
    };

    const handleColumnUpdate = (updates: Partial<ScoreColumn>) => {
        setEditedCol(prev => ({ ...prev, ...updates }));
    };

    const cycleDisplayMode = () => {
        setEditedCol(prev => {
            const mode = prev.displayMode || 'row';
            const next = mode === 'row' ? 'overlay' : (mode === 'overlay' ? 'hidden' : 'row');
            return { ...prev, displayMode: next };
        });
        setHelpText('col_help_display');
    };

    const toggleShared = () => {
        setEditedCol(prev => {
            const nextShared = !prev.isShared;
            setHelpText(nextShared ? 'col_help_shared_on' : 'col_help_shared_off');
            return { ...prev, isShared: nextShared };
        });
    };

    const toggleScoring = () => {
        setEditedCol(prev => ({ ...prev, isScoring: !prev.isScoring }));
        setHelpText(editedCol.isScoring ? 'col_help_scoring_off' : 'col_help_scoring_on');
    };



    const cellRect = editedCol.visuals?.cellRect;
    const aspectRatio = (cellRect && cellRect.height > 0) ? cellRect.width / cellRect.height : undefined;

    // Logic to determine icon/color/text based on displayMode
    const displayMode = editedCol.displayMode || 'row';
    let DisplayIcon = LayoutList;
    let displayLabelKey = 'col_display_row';
    let displayClass = 'text-txt-secondary border-surface-border bg-modal-bg hover:text-txt-title';

    if (displayMode === 'overlay') {
        DisplayIcon = Layers;
        displayLabelKey = 'col_display_overlay';
        displayClass = 'text-brand-secondary border-brand-secondary/50 bg-brand-secondary/20';
    } else if (displayMode === 'hidden') {
        DisplayIcon = EyeOff;
        displayLabelKey = 'col_display_hidden';
        displayClass = 'text-status-warning border-status-warning/50 bg-status-warning/20';
    }

    return (
        <div className="fixed inset-0 z-[70] bg-app-bg-deep flex flex-col animate-in slide-in-from-bottom-5" style={{ paddingBottom: offset }}>


            {showLayoutEditor && (
                <LayoutEditor
                    initialLayout={editedCol.contentLayout}
                    color={editedCol.color || COLORS[0]}
                    aspectRatio={aspectRatio}
                    baseImage={baseImage}
                    cellRect={cellRect}
                    onSave={(layout) => {
                        setEditedCol(prev => ({ ...prev, contentLayout: layout }));
                        setShowLayoutEditor(false);
                    }}
                    onCancel={() => setShowLayoutEditor(false)}
                />
            )}

            {/* Header: Redesigned for better airiness */}
            <header className="flex items-center justify-between px-5 py-6 bg-app-bg-deep flex-none z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-modal-bg-elevated p-2.5 rounded-xl shadow-sm text-brand-primary border border-surface-border"><Settings size={22} /></div>
                    <div><h2 className="text-txt-primary font-black text-xl leading-tight">{t('col_edit_title')}</h2><p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">{t('col_edit_subtitle')}</p></div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onDelete} className="w-10 h-10 flex items-center justify-center text-txt-secondary hover:text-status-danger bg-modal-bg-elevated rounded-xl border border-surface-border hover:border-status-danger/40 shadow-sm transition-all active:scale-90" title={tCommon('delete')}><Trash2 size={20} /></button>
                    <button onClick={handleAttemptClose} className="w-10 h-10 flex items-center justify-center text-txt-secondary hover:text-txt-title bg-modal-bg-elevated rounded-xl border border-surface-border shadow-sm transition-all active:scale-90"><X size={24} /></button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar bg-app-bg-deep">
                <section className="p-4 space-y-4">

                    {/* Name & Advanced Toggle */}
                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase mb-1">{t('col_name')}</label>
                        <div className="flex gap-2 items-start bg-modal-bg-elevated p-3 rounded-2xl border border-surface-border shadow-sm">
                            <textarea
                                ref={nameTextareaRef}
                                rows={1}
                                value={editedCol.name}
                                onChange={e => setEditedCol({ ...editedCol, name: e.target.value })}
                                onFocus={e => e.target.select()}
                                className="flex-[2] bg-modal-bg-recessed border border-surface-border rounded-xl p-3 text-txt-primary focus:border-brand-primary outline-none resize-none overflow-hidden text-base font-black min-h-[50px] transition-all"
                            />
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className={`flex-1 min-h-[50px] flex flex-col items-center justify-center gap-1 rounded-xl border transition-all active:scale-95 ${showAdvanced ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-modal-bg-recessed border-surface-border text-txt-muted hover:text-txt-primary'}`}
                            >
                                <Settings2 size={18} />
                                <span className="text-[10px] font-black uppercase tracking-tight">{t('col_advanced')}</span>
                            </button>
                        </div>

                        {/* Advanced Settings Panel */}
                        {showAdvanced && (
                            <div className="mt-2 bg-modal-bg-elevated rounded-xl p-2 border border-surface-border animate-in fade-in slide-in-from-top-1">
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {/* Scoring Toggle */}
                                    <button
                                        onClick={toggleScoring}
                                        className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${!editedCol.isScoring ? 'text-status-warning border-status-warning/50 bg-status-warning/20' : 'text-txt-secondary border-surface-border bg-modal-bg hover:text-txt-title'}`}
                                    >
                                        <div className="relative">
                                            <Sigma size={20} className={!editedCol.isScoring ? "opacity-30" : ""} />
                                            {!editedCol.isScoring && <X size={12} className="absolute -bottom-1 -right-1 text-status-warning stroke-[3]" />}
                                        </div>
                                        <span className="text-[10px]">{!editedCol.isScoring ? t('col_scoring_off') : t('col_scoring_on')}</span>
                                    </button>

                                    {/* Layout Crop */}
                                    <button
                                        onClick={() => { setShowLayoutEditor(true); setHelpText('col_help_crop'); }}
                                        className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${editedCol.contentLayout ? 'text-status-info border-status-info/50 bg-status-info/20' : 'text-txt-secondary border-surface-border bg-modal-bg hover:text-txt-title'}`}
                                    >
                                        <Crop size={20} />
                                        <span className="text-[10px]">{editedCol.contentLayout ? t('col_cropped') : t('col_crop')}</span>
                                    </button>

                                    {/* Display Mode (3-Way Toggle) */}
                                    <button
                                        onClick={cycleDisplayMode}
                                        className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${displayClass}`}
                                    >
                                        <DisplayIcon size={20} />
                                        <span className="text-[10px]">{t(displayLabelKey as any)}</span>
                                    </button>

                                    {/* Shared Variable Toggle */}
                                    <button
                                        onClick={toggleShared}
                                        className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${editedCol.isShared ? 'text-brand-primary border-brand-primary/50 bg-brand-primary/20' : 'text-txt-secondary border-surface-border bg-modal-bg hover:text-txt-title'}`}
                                    >
                                        <Users size={20} />
                                        <span className="text-[10px]">{t('col_shared_var' as any)}</span>
                                    </button>
                                </div>
                                <div className="bg-modal-bg/50 rounded py-1 px-2 text-center text-[10px] text-txt-secondary border border-surface-border/50 flex items-center justify-center gap-1">
                                    <Info size={10} /> {t(helpText as any)}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase mb-2">{t('col_color')}</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {COLORS.map(c => (
                                <button key={c} onClick={() => setEditedCol({ ...editedCol, color: c })} className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${editedCol.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/50' : ''}`} style={{ backgroundColor: c }} />
                            ))}
                            <button onClick={() => setEditedCol({ ...editedCol, color: undefined })} className={`w-8 h-8 rounded-full shadow-lg border-2 flex items-center justify-center bg-modal-bg-elevated text-txt-secondary transition-transform active:scale-90 ${!editedCol.color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}><X size={16} /></button>
                        </div>
                    </div>
                </section>

                <div className="sticky top-0 z-10 flex border-y border-surface-border bg-modal-bg shadow-lg">
                    <TabButton id="basic" activeTab={activeTab} setActiveTab={setActiveTab} label={t('col_tab_basic')} icon={Calculator} />
                    <TabButton id="select" activeTab={activeTab} setActiveTab={setActiveTab} label={t('col_tab_select')} icon={ListPlus} />
                    <TabButton id="mapping" activeTab={activeTab} setActiveTab={setActiveTab} label={t('col_tab_mapping')} icon={Ruler} />
                    <TabButton id="auto" activeTab={activeTab} setActiveTab={setActiveTab} label={t('col_tab_auto')} icon={Sparkles} isSpecial />
                </div>
                <div className="p-4 pb-4">{renderTabContent()}</div>
            </main>
            {!isKeyboardOpen && (
                <footer className="flex-none p-4 bg-modal-bg/80 backdrop-blur-sm border-t border-surface-border" style={{ paddingBottom: `calc(1rem + ${offset}px)` }}>
                    <button onClick={handleSave} className="w-full py-3 bg-brand-primary-deep hover:bg-brand-primary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/50 flex items-center justify-center gap-2"><Save size={20} /> {t('col_btn_save')}</button>
                </footer>
            )}
        </div>
    );

    function renderTabContent() {
        switch (activeTab) {
            case 'auto': return (
                <EditorTabAuto column={editedCol} allColumns={allColumns} onChange={handleColumnUpdate} />
            );
            case 'mapping': return (
                <EditorTabMapping column={editedCol} onChange={handleColumnUpdate} />
            );
            case 'select': return (
                <EditorTabSelection column={editedCol} onChange={handleColumnUpdate} />
            );
            case 'basic':
            default: return (
                <EditorTabBasic
                    column={editedCol}
                    onChange={handleColumnUpdate}
                    cachedSumPartsInputType={sumPartsInputTypeCache.current}
                    onUpdateCachedSumPartsInputType={(type) => { sumPartsInputTypeCache.current = type; }}
                />
            );
        }
    }
};

export default ColumnConfigEditor;

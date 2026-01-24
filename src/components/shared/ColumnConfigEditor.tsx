
import React, { useState, useEffect, useRef } from 'react';
import { ScoreColumn, InputMethod, MappingRule } from '../../types';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Trash2, Crop, LayoutList, Layers, Sigma, Sparkles, Settings2, Info } from 'lucide-react';
import { COLORS } from '../../colors';
import { isColorDark } from '../../utils/ui';
import { useVisualViewportOffset } from '../../hooks/useVisualViewportOffset';
import ConfirmationModal from './ConfirmationModal';
import LayoutEditor from './LayoutEditor';
import EditorTabMapping from './column-editor/EditorTabMapping';
import EditorTabSelection from './column-editor/EditorTabSelection';
import EditorTabBasic from './column-editor/EditorTabBasic';
import EditorTabAuto from './column-editor/EditorTabAuto';
import { extractIdentifiers } from '../../utils/formulaEvaluator';
import { useColumnEditorTranslation } from '../../i18n/column_editor'; // Changed Import

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

const ColumnConfigEditor: React.FC<ColumnConfigEditorProps> = ({ column, allColumns = [], onSave, onDelete, onClose, baseImage }) => {
  const { t } = useColumnEditorTranslation(); // Use New Hook
  
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
      (editedCol.formula || '').includes('+next') ? (editedCol.inputType || 'keypad') : 'keypad'
  );

  const getInitialTab = (col: ScoreColumn): EditorTab => {
    if (col.inputType === 'auto') return 'auto';
    if ((col.formula || '').startsWith('f1')) return 'mapping';
    if (col.inputType === 'clicker' && !col.formula.includes('+next')) return 'select';
    return 'basic';
  };

  const [activeTab, setActiveTab] = useState<EditorTab>(() => getInitialTab(editedCol));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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
  
  const visualViewportOffset = useVisualViewportOffset();
  const [isResizedByKeyboard, setIsResizedByKeyboard] = useState(false);
  
  useEffect(() => {
      const initialHeight = window.innerHeight;
      const handleResize = () => setIsResizedByKeyboard(initialHeight - window.innerHeight > 150);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isKeyboardOpen = visualViewportOffset > 0 || isResizedByKeyboard;

  const hasUnsavedChanges = () => JSON.stringify(editedCol) !== initialStringifiedRef.current;

  const handleAttemptClose = () => {
      if (hasUnsavedChanges()) setShowDiscardConfirm(true);
      else onClose();
  };

  useEffect(() => {
      const handleBackPress = (e: Event) => {
          e.stopImmediatePropagation();
          if (showLayoutEditor) {
              setShowLayoutEditor(false);
              return;
          }
          handleAttemptClose();
      };
      window.addEventListener('app-back-press', handleBackPress, { capture: true });
      return () => window.removeEventListener('app-back-press', handleBackPress, { capture: true });
  }, [editedCol, showLayoutEditor]);

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
                          : { id: PLAYER_COUNT_ID, name: '玩家人數', mode: 'value' };
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
                  // Preserve current input settings (allows clicker/keypad)
                  finalUpdates.inputType = editedCol.inputType || 'keypad';
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
                  finalUpdates.inputType = editedCol.inputType || sumPartsInputTypeCache.current || 'keypad';
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

      // --- Save Preferences ---
      if (activeTab === 'basic') {
          if (getCalculationMode(finalUpdates.formula || '') === 'product') {
              if (finalUpdates.subUnits && finalUpdates.subUnits.length === 2) {
                  if (finalUpdates.subUnits[0]) localStorage.setItem(PREF_KEY_PROD_UNIT_A, finalUpdates.subUnits[0]);
                  if (finalUpdates.subUnits[1]) localStorage.setItem(PREF_KEY_PROD_UNIT_B, finalUpdates.subUnits[1]);
              }
          } else {
              if (finalUpdates.unit) localStorage.setItem(PREF_KEY_STD_UNIT, finalUpdates.unit);
          }
      } else if (activeTab === 'mapping') {
          if (finalUpdates.unit) localStorage.setItem(PREF_KEY_STD_UNIT, finalUpdates.unit);
      }

      onSave(finalUpdates);
  };
  
  const handleColumnUpdate = (updates: Partial<ScoreColumn>) => {
      setEditedCol(prev => ({ ...prev, ...updates }));
  };

  const toggleDisplayMode = () => {
      setEditedCol(prev => ({
          ...prev,
          displayMode: prev.displayMode === 'row' ? 'overlay' : 'row'
      }));
      setHelpText('col_help_display');
  };

  const toggleScoring = () => {
      setEditedCol(prev => ({ ...prev, isScoring: !prev.isScoring }));
      setHelpText(editedCol.isScoring ? 'col_help_scoring_off' : 'col_help_scoring_on');
  };

  const TabButton = ({ id, label, icon: Icon, isSpecial }: { id: EditorTab, label: string, icon: any, isSpecial?: boolean }) => (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`${isSpecial ? 'flex-1' : 'flex-[2]'} py-3 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors border-b-2 
            ${activeTab === id 
                ? (isSpecial ? 'border-indigo-500 text-indigo-400 bg-slate-800' : 'border-emerald-500 text-emerald-400 bg-slate-800') 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }
        `}
      >
          <Icon size={18} />{label}
      </button>
  );

  const cellRect = editedCol.visuals?.cellRect;
  const aspectRatio = (cellRect && cellRect.height > 0) ? cellRect.width / cellRect.height : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-bottom-5" style={{ paddingBottom: visualViewportOffset }}>
      <ConfirmationModal 
        isOpen={showDiscardConfirm} 
        title={t('col_discard_title')} 
        message={t('col_discard_msg')} 
        confirmText={t('col_discard_confirm')} 
        cancelText={t('col_discard_cancel')} 
        isDangerous={true} 
        onConfirm={onClose} 
        onCancel={() => setShowDiscardConfirm(false)} 
      />
      
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

      {/* Header: Simplified */}
      <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-20">
          <div className="flex items-center gap-2">
              <div className="bg-slate-800 p-2 rounded text-emerald-500"><Settings size={20}/></div>
              <div><h2 className="text-white font-bold text-lg">{t('col_edit_title')}</h2><p className="text-xs text-slate-500">{t('col_edit_subtitle')}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg border border-slate-700 hover:border-red-900/50" title={t('delete')}><Trash2 size={20}/></button>
            <button onClick={handleAttemptClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"><X size={20}/></button>
          </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
          <section className="p-4 bg-slate-900/50 space-y-4">
              
              {/* Name & Advanced Toggle */}
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('col_name')}</label>
                  <div className="flex gap-2 items-start">
                      <textarea 
                        ref={nameTextareaRef} 
                        rows={1} 
                        value={editedCol.name} 
                        onChange={e => setEditedCol({...editedCol, name: e.target.value})} 
                        onFocus={e => e.target.select()} 
                        className="flex-[2] bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none resize-none overflow-hidden text-base font-bold min-h-[50px]"
                      />
                      <button 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className={`flex-1 min-h-[50px] flex flex-col items-center justify-center gap-1 rounded-xl border transition-all active:scale-95 ${showAdvanced ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`}
                      >
                          <Settings2 size={18} />
                          <span className="text-[10px] font-bold">{t('col_advanced')}</span>
                      </button>
                  </div>

                  {/* Advanced Settings Panel */}
                  {showAdvanced && (
                      <div className="mt-2 bg-slate-800 rounded-xl p-2 border border-slate-700 animate-in fade-in slide-in-from-top-1">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                              {/* Scoring Toggle */}
                              <button 
                                onClick={toggleScoring} 
                                className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${!editedCol.isScoring ? 'text-amber-400 border-amber-500/50 bg-amber-900/20' : 'text-slate-400 border-slate-700 bg-slate-900 hover:text-white'}`}
                              >
                                  <div className="relative">
                                      <Sigma size={20} className={!editedCol.isScoring ? "opacity-30" : ""} />
                                      {!editedCol.isScoring && <X size={12} className="absolute -bottom-1 -right-1 text-amber-500 stroke-[3]" />}
                                  </div>
                                  <span className="text-[10px]">{!editedCol.isScoring ? t('col_scoring_off') : t('col_scoring_on')}</span>
                              </button>

                              {/* Layout Crop */}
                              <button 
                                onClick={() => { setShowLayoutEditor(true); setHelpText('col_help_crop'); }} 
                                className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${editedCol.contentLayout ? 'text-sky-400 border-sky-500/50 bg-sky-900/20' : 'text-slate-400 border-slate-700 bg-slate-900 hover:text-white'}`}
                              >
                                  <Crop size={20} />
                                  <span className="text-[10px]">{editedCol.contentLayout ? t('col_cropped') : t('col_crop')}</span>
                              </button>

                              {/* Display Mode */}
                              <button 
                                onClick={toggleDisplayMode} 
                                className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${editedCol.displayMode === 'overlay' ? 'text-indigo-400 border-indigo-500/50 bg-indigo-900/20' : 'text-slate-400 border-slate-700 bg-slate-900 hover:text-white'}`}
                              >
                                  {editedCol.displayMode === 'overlay' ? <Layers size={20}/> : <LayoutList size={20}/>}
                                  <span className="text-[10px]">{editedCol.displayMode === 'overlay' ? t('col_display_overlay') : t('col_display_row')}</span>
                              </button>
                          </div>
                          <div className="bg-slate-900/50 rounded py-1 px-2 text-center text-[10px] text-slate-400 border border-slate-800/50 flex items-center justify-center gap-1">
                              <Info size={10} /> {t(helpText as any)}
                          </div>
                      </div>
                  )}
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('col_color')}</label>
                  <div className="flex items-center gap-2 flex-wrap">
                      {COLORS.map(c => (
                          <button key={c} onClick={() => setEditedCol({ ...editedCol, color: c })} className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${editedCol.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/50' : ''}`} style={{backgroundColor: c}} />
                      ))}
                      <button onClick={() => setEditedCol({ ...editedCol, color: undefined })} className={`w-8 h-8 rounded-full shadow-lg border-2 flex items-center justify-center bg-slate-700 text-slate-400 transition-transform active:scale-90 ${!editedCol.color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}><X size={16}/></button>
                  </div>
              </div>
          </section>

          <div className="sticky top-0 z-10 flex border-y border-slate-800 bg-slate-900 shadow-lg">
              <TabButton id="basic" label={t('col_tab_basic')} icon={Calculator} />
              <TabButton id="select" label={t('col_tab_select')} icon={ListPlus} />
              <TabButton id="mapping" label={t('col_tab_mapping')} icon={Ruler} />
              <TabButton id="auto" label={t('col_tab_auto')} icon={Sparkles} isSpecial />
          </div>
          <div className="p-4 pb-24">{renderTabContent()}</div>
      </main>
      {!isKeyboardOpen && (
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 z-20" style={{ paddingBottom: `calc(1rem + ${visualViewportOffset}px)` }}>
              <button onClick={handleSave} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"><Save size={20} /> {t('col_btn_save')}</button>
          </footer>
      )}
    </div>
  );

  function renderTabContent() {
    switch(activeTab) {
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
                onUpdateCachedSumPartsInputType={(type) => sumPartsInputTypeCache.current = type}
            />
        );
    }
  }
};

export default ColumnConfigEditor;

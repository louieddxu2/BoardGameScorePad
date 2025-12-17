
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScoreColumn, SelectOption, MappingRule, QuickAction, InputMethod } from '../../types';
import { calculateColumnScore } from '../../utils/scoring';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Plus, Trash2, BoxSelect, PlusSquare, Keyboard, MousePointerClick, Palette, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, LayoutGrid, LayoutList, ArrowUp, TrendingUp, Ban, ArrowUpToLine, Infinity as InfinityIcon, ArrowRight as ArrowRightIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { COLORS } from '../../colors';
import { useVisualViewportOffset } from '../../hooks/useVisualViewportOffset';
import ConfirmationModal from './ConfirmationModal';

interface ColumnConfigEditorProps {
  column: ScoreColumn;
  onSave: (updates: Partial<ScoreColumn>) => void;
  onDelete: () => void;
  onClose: () => void;
}

type EditorTab = 'basic' | 'mapping' | 'select';

// Helper to determine if a color is dark and needs a light text shadow for contrast
const isColorDark = (hex: string): boolean => {
    const darkColors = ['#a16207', '#6b7280', '#1f2937', '#0f172a']; // Brown, Gray, Black, Slate 900
    return darkColors.includes(hex.toLowerCase());
};

const ColumnConfigEditor: React.FC<ColumnConfigEditorProps> = ({ column, onSave, onDelete, onClose }) => {
  
  // --- Initialization Logic ---
  // We need to run this logic once to get the starting state, and keep a copy for dirty checking.
  const getInitialState = (): ScoreColumn => {
    // Auto-convert boolean to select on init
    if (column.type === 'boolean') {
        const yesScore = column.weight ?? 0;
        return {
            ...column,
            type: 'select',
            weight: 1, // Reset weight as the value is now in options
            options: [
                { label: 'YES (達成)', value: yesScore },
                { label: 'NO (未達成)', value: 0 }
            ]
        };
    }
    
    // Convert legacy overflow settings to a new linear rule if applicable
    let rules = column.mappingRules ? [...column.mappingRules] : [];
    
    // Check if we need to migrate legacy overflow settings
    let maxBoundary = -Infinity;
    let lastRuleIsInfinite = false;
    rules.forEach((r, idx) => {
          let eMax = r.max === 'next' ? (rules[idx+1]?.min ? rules[idx+1].min! - 1 : Infinity) : (r.max ?? Infinity);
          if (eMax > maxBoundary) maxBoundary = eMax;
          if (eMax === Infinity) lastRuleIsInfinite = true;
    });

    if (!lastRuleIsInfinite && maxBoundary > -Infinity && column.mappingStrategy === 'linear') {
        rules.push({
            min: maxBoundary + 1,
            max: undefined, // Infinity
            score: column.linearScore ?? 1,
            isLinear: true,
            unit: column.linearUnit ?? 1
        });
    }

    // NEW: Enforce first rule is always fixed (non-linear)
    if (rules.length > 0 && rules[0].isLinear) {
        rules[0] = { ...rules[0], isLinear: false };
    }

    return { 
        ...column, 
        mappingRules: rules,
    };
  };

  // Lazy initialization of state
  const [editedCol, setEditedCol] = useState<ScoreColumn>(getInitialState);
  
  // Name Textarea Auto-height Logic
  const nameTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
      const textarea = nameTextareaRef.current;
      if (textarea) {
          // The two-step process is crucial for both growing and shrinking
          textarea.style.height = 'auto'; 
          textarea.style.height = `${textarea.scrollHeight}px`;
      }
  }, [editedCol.name]); // Reruns whenever the name value changes

  // Keep a ref to the initial state for dirty checking comparison
  // We serialize it to avoid object reference issues
  const initialStringifiedRef = useRef(JSON.stringify(getInitialState()));

  const [activeTab, setActiveTab] = useState<EditorTab>(() => {
      if (column.type === 'select' || column.type === 'boolean') return 'select';
      
      const hasRules = column.mappingRules && column.mappingRules.length > 0;
      if (column.useMapping === true) return 'mapping';
      if (column.useMapping === false) return 'basic';
      if (hasRules) return 'mapping';
      
      return 'basic';
  });

  const [quickActionColorPickerIdx, setQuickActionColorPickerIdx] = useState<number | null>(null);
  const [selectOptionColorPickerIdx, setSelectOptionColorPickerIdx] = useState<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
  // --- Keyboard & Layout Handling ---
  const visualViewportOffset = useVisualViewportOffset();
  const [isResizedByKeyboard, setIsResizedByKeyboard] = useState(false);
  
  useEffect(() => {
      if (typeof window === 'undefined') return;
      const initialHeight = window.innerHeight;
      
      const handleResize = () => {
          const heightDiff = initialHeight - window.innerHeight;
          setIsResizedByKeyboard(heightDiff > 150);
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isKeyboardOpen = visualViewportOffset > 0 || isResizedByKeyboard;

  useEffect(() => {
      if (isKeyboardOpen) {
          const timer = setTimeout(() => {
              const activeEl = document.activeElement;
              if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                  activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
          }, 300);
          return () => clearTimeout(timer);
      }
  }, [isKeyboardOpen]);

  // --- Dirty Check & Close Handling ---
  
  const hasUnsavedChanges = () => {
      return JSON.stringify(editedCol) !== initialStringifiedRef.current;
  };

  const handleAttemptClose = () => {
      if (hasUnsavedChanges()) {
          setShowDiscardConfirm(true);
      } else {
          onClose();
      }
  };

  // 攔截手機返回鍵 (Back Button Interceptor)
  useEffect(() => {
      const handleBackPress = (e: Event) => {
          // IMPORTANT: 使用 capture: true 註冊此監聽器，確保我們比父層 (SessionView) 先收到事件
          // 如果有未儲存的變更，我們就阻止事件繼續傳遞，並顯示確認視窗
          // 如果沒有變更，我們也阻止傳遞，並直接呼叫 onClose (這樣流程比較乾淨，由子元件控制關閉)
          e.stopImmediatePropagation();
          handleAttemptClose();
      };

      window.addEventListener('app-back-press', handleBackPress, { capture: true });
      return () => {
          window.removeEventListener('app-back-press', handleBackPress, { capture: true });
      };
  }, [editedCol]); // 依賴 editedCol 以便 handleAttemptClose 取得最新狀態 (或者使用 Ref)


  const handleSave = () => {
    // When saving, ensure the type matches the active tab mode
    let finalUpdates: Partial<ScoreColumn> = { ...editedCol };
    
    if (activeTab === 'mapping') {
        finalUpdates.type = 'number';
        finalUpdates.calculationType = 'standard'; // Mapping overrides product logic
        finalUpdates.useMapping = true; // Explicitly enable mapping
        
        if (!finalUpdates.mappingRules) finalUpdates.mappingRules = [];
        
        finalUpdates.mappingStrategy = undefined;
        finalUpdates.linearUnit = undefined;
        finalUpdates.linearScore = undefined;
        
    } else if (activeTab === 'select') {
        finalUpdates.type = 'select';
        finalUpdates.calculationType = 'standard';
    } else {
        // Basic tab -> Type Number
        finalUpdates.type = 'number';
        finalUpdates.useMapping = false; 
        
        if (finalUpdates.rounding === 'none') {
            // keep it none
        }
        if (finalUpdates.inputType === 'keypad') {
            // keep clicker settings but they won't be used
        }
    }
    
    onSave(finalUpdates);
  };

  // --- Mapping Rule Helpers ---
  
  const getMinConstraint = (idx: number, rules: MappingRule[]): number => {
      if (idx === 0) return -999999;
      const prevRule = rules[idx - 1];
      let prevEnd = 0;
      if (prevRule.max === 'next') {
          prevEnd = prevRule.min ?? 0; 
      } else {
          prevEnd = prevRule.max ?? prevRule.min ?? 0;
      }
      return prevEnd + 1;
  };

  const updateMappingRule = (idx: number, field: keyof MappingRule, val: any) => {
      const newRules = [...(editedCol.mappingRules || [])];
      
      // Special logic for isLinear toggle
      if (field === 'isLinear') {
          // Rule 0 cannot be linear
          if (idx === 0) return;

          const isLinear = val as boolean;
          newRules[idx] = { 
              ...newRules[idx], 
              isLinear,
              // When switching to linear, default to "Every 1 Add 1" per user request
              unit: isLinear ? 1 : undefined,
              score: isLinear ? 1 : newRules[idx].score
          };
      } else {
          let newValue = val;
          // Enforce constraints
          if (field === 'min' && typeof newValue === 'number') {
              const minLimit = getMinConstraint(idx, newRules);
              if (newValue < minLimit) newValue = minLimit;
          }
          if (field === 'max' && typeof newValue === 'number') {
              const currentMin = newRules[idx].min;
              if (currentMin !== undefined && newValue < currentMin) {
                  newValue = currentMin;
              }
          }
          if (field === 'unit' && typeof newValue === 'number') {
              newValue = Math.max(1, newValue);
          }
          
          newRules[idx] = { ...newRules[idx], [field]: newValue };
      }

      setEditedCol({ ...editedCol, mappingRules: newRules });
  };

  const addMappingRule = () => {
      const rules = [...(editedCol.mappingRules || [])];
      let newMin = 0;
      let lastScore = 0;
      
      if (rules.length > 0) {
          const lastRule = rules[rules.length - 1];
          lastScore = lastRule.score; // Copy prev score as default
          
          if (typeof lastRule.max === 'number') {
              newMin = lastRule.max + 1;
          } else if (lastRule.min !== undefined) {
              newMin = lastRule.min + 1;
          }

          // Update the LAST rule to be 'next' (dynamic link)
          rules[rules.length - 1] = {
              ...lastRule,
              max: 'next'
          };
      }

      setEditedCol({ ...editedCol, mappingRules: [...rules, { min: newMin, max: undefined, score: lastScore, isLinear: false }] });
  };

  const removeMappingRule = (idx: number) => {
      const newRules = (editedCol.mappingRules || []).filter((_, i) => i !== idx);
      
      // If we removed a rule, make the previous rule open-ended (undefined/Infinity) to avoid stuck 'next'
      if (idx > 0 && idx === (editedCol.mappingRules?.length || 0) - 1) {
          const newLastIdx = newRules.length - 1;
          if (newLastIdx >= 0 && newRules[newLastIdx].max === 'next') {
              newRules[newLastIdx] = { ...newRules[newLastIdx], max: undefined };
          }
      }
      
      // If we removed Rule 0, enforce that the NEW Rule 0 is fixed
      if (idx === 0 && newRules.length > 0) {
          newRules[0] = { ...newRules[0], isLinear: false };
      }

      setEditedCol({ ...editedCol, mappingRules: newRules });
  };
  

  // --- Select Option Helpers ---
  const updateOption = (idx: number, field: keyof SelectOption, val: any) => {
      const newOptions = [...(editedCol.options || [])];
      newOptions[idx] = { ...newOptions[idx], [field]: val };
      setEditedCol({ ...editedCol, options: newOptions });
  };

  const addOption = () => {
      setEditedCol({ ...editedCol, options: [...(editedCol.options || []), { value: 0, label: '' }] });
  };

  const removeOption = (idx: number) => {
      setEditedCol({ ...editedCol, options: (editedCol.options || []).filter((_, i) => i !== idx) });
  };

  // --- Quick Action Helpers ---
  const addQuickAction = () => {
      // 預設標籤改為空字串，以符合需求
      const newAction: QuickAction = { id: crypto.randomUUID(), label: '', value: 1, isModifier: false };
      setEditedCol({ ...editedCol, quickActions: [...(editedCol.quickActions || []), newAction] });
  };

  const updateQuickAction = (idx: number, field: keyof QuickAction, val: any) => {
      const newActions = [...(editedCol.quickActions || [])];
      newActions[idx] = { ...newActions[idx], [field]: val };
      setEditedCol({ ...editedCol, quickActions: newActions });
  };

  const removeQuickAction = (idx: number) => {
      setEditedCol({ ...editedCol, quickActions: (editedCol.quickActions || []).filter((_, i) => i !== idx) });
  };

  // --- Toggle Helpers ---
  const isRoundingEnabled = editedCol.rounding && editedCol.rounding !== 'none';
  const toggleRounding = () => {
      setEditedCol({ ...editedCol, rounding: isRoundingEnabled ? 'none' : 'round' });
  };

  const isClickerEnabled = editedCol.inputType === 'clicker';
  const toggleInputMethod = () => {
      const newMethod = isClickerEnabled ? 'keypad' : 'clicker';
      let updates: Partial<ScoreColumn> = { inputType: newMethod };
      if (newMethod === 'clicker' && (!editedCol.quickActions || editedCol.quickActions.length === 0)) {
           // 預設標籤改為空字串
           updates.quickActions = [{ id: crypto.randomUUID(), label: '', value: 1 }];
           updates.buttonGridColumns = 1;
      }
      setEditedCol({ ...editedCol, ...updates });
  };


  // UI Components
  const TabButton = ({ id, label, icon: Icon }: { id: EditorTab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors border-b-2 ${activeTab === id ? 'border-emerald-500 text-emerald-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
      >
          <Icon size={18} />
          {label}
      </button>
  );
  
  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: string }) => (
      <div onClick={onChange} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors">
          <span className="text-sm font-bold text-slate-300">{label}</span>
          <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
      </div>
  );

  const isProductMode = editedCol.calculationType === 'product';
  const isSumPartsMode = editedCol.calculationType === 'sum-parts';
  const isStandardMode = !isProductMode && !isSumPartsMode;


  return (
    <div 
        className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-bottom-5"
        // 這裡套用 visualViewportOffset，確保在 iOS 上即使鍵盤 Overlay，整個 Modal 也會縮上來
        // 但我們選擇一個更聰明的策略：當鍵盤開啟時，隱藏 Footer，並讓 Content 填滿剩餘空間
        style={{ paddingBottom: visualViewportOffset }}
    >
      <ConfirmationModal 
          isOpen={showDiscardConfirm}
          title="放棄變更？"
          message="您有未儲存的變更，離開後將會遺失。"
          confirmText="放棄並離開"
          cancelText="繼續編輯"
          isDangerous={true}
          onConfirm={onClose}
          onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-20">
          <div className="flex items-center gap-2">
              <div className="bg-slate-800 p-2 rounded text-emerald-500"><Settings size={20}/></div>
              <div>
                  <h2 className="text-white font-bold text-lg">編輯項目</h2>
                  <p className="text-xs text-slate-500">{editedCol.name}</p>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button 
                onClick={onDelete}
                className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg border border-slate-700 hover:border-red-900/50"
                title="刪除此項目"
              >
                  <Trash2 size={20}/>
              </button>
              <button onClick={handleAttemptClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"><X size={20}/></button>
          </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
          
          {/* Global Config Section */}
          <div className="p-4 bg-slate-900/50 space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">欄位名稱</label>
                  <textarea 
                    ref={nameTextareaRef}
                    rows={1}
                    value={editedCol.name} 
                    onChange={e => setEditedCol({...editedCol, name: e.target.value})}
                    onFocus={e => e.target.select()}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none resize-none overflow-hidden"
                  />
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">代表色</label>
                  <div className="flex items-center gap-2 flex-wrap">
                      {COLORS.map(c => {
                        const isDark = isColorDark(c);
                        return (
                          <button
                              key={c}
                              onClick={() => setEditedCol({ ...editedCol, color: c })}
                              className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${editedCol.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isDark ? 'ring-1 ring-white/50' : ''}`}
                              style={{backgroundColor: c}}
                          />
                        );
                      })}
                      <button
                          onClick={() => setEditedCol({ ...editedCol, color: undefined })}
                          className={`w-8 h-8 rounded-full shadow-lg border-2 flex items-center justify-center bg-slate-700 text-slate-400 transition-transform active:scale-90 ${!editedCol.color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      >
                         <X size={16}/>
                      </button>
                  </div>
              </div>
          </div>

          {/* Sticky Tabs */}
          <div className="sticky top-0 z-10 flex border-y border-slate-800 bg-slate-900 shadow-lg">
              <TabButton id="basic" label="數值運算" icon={Calculator} />
              <TabButton id="mapping" label="範圍查表" icon={Ruler} />
              <TabButton id="select" label="列表選單" icon={ListPlus} />
          </div>

          {/* Tab Content */}
          <div className="p-4 pb-24"> {/* Extra padding bottom so content isn't hidden behind keyboard or footer */}
            {activeTab === 'basic' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Calculation Mode Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">計分模式</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setEditedCol({ ...editedCol, calculationType: 'standard' })}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    isStandardMode
                                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'
                                }`}
                            >
                                <Calculator size={24} />
                                <div className="leading-tight text-center">
                                    <div className="text-xs font-bold uppercase">基本加權</div>
                                    <div className="text-[10px] opacity-70">數值 × 倍率</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setEditedCol({ ...editedCol, calculationType: 'sum-parts' })}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    isSumPartsMode
                                        ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(2,132,199,0.2)]'
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'
                                }`}
                            >
                                <PlusSquare size={24} />
                                <div className="leading-tight text-center">
                                    <div className="text-xs font-bold uppercase">分項累加</div>
                                    <div className="text-[10px] opacity-70">1+2+3...</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setEditedCol({ 
                                    ...editedCol, 
                                    calculationType: 'product',
                                    // inputType: 'keypad', // REMOVED: Do not override inputType for Product mode
                                    subUnits: (editedCol.subUnits && editedCol.subUnits[0] && editedCol.subUnits[1]) ? editedCol.subUnits : ['分', '個']
                                })}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    isProductMode
                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'
                                }`}
                            >
                                <BoxSelect size={24} />
                                <div className="leading-tight text-center">
                                    <div className="text-xs font-bold uppercase">乘積輸入</div>
                                    <div className="text-[10px] opacity-70"> A × B</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {isProductMode ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">乘積單位</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1"> A 的單位</label>
                                        <input 
                                            type="text" 
                                            value={editedCol.subUnits?.[0] || ''}
                                            onChange={e => setEditedCol({ ...editedCol, subUnits: [e.target.value, editedCol.subUnits?.[1] || ''] })}
                                            onFocus={e => e.target.select()}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1"> B 的單位</label>
                                        <input 
                                            type="text" 
                                            value={editedCol.subUnits?.[1] || ''}
                                            onChange={e => setEditedCol({ ...editedCol, subUnits: [editedCol.subUnits?.[0] || '', e.target.value] })}
                                            onFocus={e => e.target.select()}
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-2">
                                <span className="text-slate-400 text-sm">A</span>
                                <span className="text-emerald-500 font-bold">×</span>
                                <span className="text-slate-400 text-sm">B</span>
                                <span className="text-slate-600">=</span>
                                <span className="text-white font-bold">總分</span>
                            </div>
                        </div>
                    ) : (
                        <div className={`space-y-4 animate-in fade-in slide-in-from-top-2 p-4 rounded-xl border ${isSumPartsMode ? 'bg-sky-900/10 border-sky-500/20' : 'bg-emerald-900/10 border-emerald-500/20'}`}>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label>
                                <input 
                                    type="text" 
                                    value={editedCol.unit || ''} 
                                    onChange={e => setEditedCol({...editedCol, unit: e.target.value})}
                                    onFocus={e => e.target.select()}
                                    placeholder="如：分、個、元"
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-3">
                                <span className="text-slate-400 text-sm">{isSumPartsMode ? '分項總和' : '輸入值'}</span>
                                <span className="text-slate-600">×</span>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={editedCol.weight ?? 1} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        // Allow decimal intermediate state
                                        if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                            setEditedCol({...editedCol, weight: val as any});
                                        } else {
                                            const num = parseFloat(val);
                                            if (!isNaN(num)) setEditedCol({...editedCol, weight: num});
                                        }
                                    }}
                                    onFocus={e => e.target.select()}
                                    className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded outline-none focus:border-emerald-500"
                                />
                                <span className="text-slate-600">=</span>
                                <span className="text-white font-bold">得分</span>
                            </div>
                        </div>
                    )}

                    {/* Input Method Toggle - Only for Sum Parts Mode */}
                    {isSumPartsMode && (
                        <>
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">格內顯示方式</label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                                    <button
                                        onClick={() => setEditedCol({ ...editedCol, showPartsInGrid: true })}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                            (editedCol.showPartsInGrid ?? true) === true 
                                                ? 'bg-sky-600 text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <Eye size={14} /> 顯示各項
                                    </button>
                                    <button
                                        onClick={() => setEditedCol({ ...editedCol, showPartsInGrid: false })}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                            (editedCol.showPartsInGrid ?? true) === false
                                                ? 'bg-sky-600 text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <EyeOff size={14} /> 僅顯示總和
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-800">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入方式</label>
                                <ToggleSwitch 
                                    checked={isClickerEnabled} 
                                    onChange={toggleInputMethod}
                                    label="自訂按鈕加減面板"
                                />
                                
                                {isClickerEnabled && (
                                    <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-400 uppercase">按鈕欄數</label>
                                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                                {[1, 2, 3, 4].map(cols => (
                                                    <button
                                                        key={cols}
                                                        onClick={() => setEditedCol({ ...editedCol, buttonGridColumns: cols })}
                                                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                                                            (editedCol.buttonGridColumns || 1) === cols 
                                                                ? 'bg-slate-600 text-white' 
                                                                : 'text-slate-500 hover:text-slate-300'
                                                        }`}
                                                    >
                                                        {cols}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mb-2">
                                            {(editedCol.buttonGridColumns || 1) === 1 
                                                ? '目前為「清單模式」：按鈕將橫向排列，最適合閱讀。' 
                                                : '目前為「網格模式」：按鈕將縱向堆疊，節省空間。'
                                            }
                                        </div>
                                        
                                        <div className="border-t border-slate-700/50 pt-4 space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">按鈕列表</label>
                                            {editedCol.quickActions?.map((action, idx) => (
                                                <div key={action.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => updateQuickAction(idx, 'isModifier', !action.isModifier)}
                                                            className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                                                                action.isModifier 
                                                                    ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/10 text-indigo-400' 
                                                                    : 'border border-slate-600 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400'
                                                            }`}
                                                            title="切換為額外添加鍵"
                                                        >
                                                            <Plus size={18} strokeWidth={action.isModifier ? 3 : 2} />
                                                        </button>
                                                        
                                                        {/* Color Picker Toggle */}
                                                        <button
                                                            onClick={() => setQuickActionColorPickerIdx(quickActionColorPickerIdx === idx ? null : idx)}
                                                            className="w-9 h-9 shrink-0 rounded-lg border border-slate-600 flex items-center justify-center shadow-sm relative overflow-hidden"
                                                            style={{ backgroundColor: action.color || editedCol.color || '#ffffff' }}
                                                            title="設定按鈕顏色"
                                                        >
                                                            <Palette size={14} className={isColorDark(action.color || editedCol.color || '#ffffff') ? 'text-white/80' : 'text-black/50'} />
                                                        </button>

                                                        <div className="flex-1 flex gap-2 min-w-0">
                                                            <input 
                                                                type="text" placeholder="標籤" value={action.label}
                                                                onChange={e => updateQuickAction(idx, 'label', e.target.value)}
                                                                onFocus={e => e.target.select()}
                                                                className="flex-1 min-w-[40px] bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"
                                                            />
                                                            <div className="relative w-14 shrink-0">
                                                                <input 
                                                                    type="text" 
                                                                    inputMode="decimal"
                                                                    placeholder="0" 
                                                                    value={action.value}
                                                                    onChange={e => {
                                                                        const str = e.target.value;
                                                                        if (str === '-' || str === '' || str.endsWith('.') || (str.includes('.') && str.endsWith('0'))) {
                                                                            updateQuickAction(idx, 'value', str as any);
                                                                            return;
                                                                        }
                                                                        const num = parseFloat(str);
                                                                        if (!isNaN(num)) {
                                                                            updateQuickAction(idx, 'value', num);
                                                                        }
                                                                    }}
                                                                    onFocus={e => e.target.select()}
                                                                    className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-2 text-right text-sm outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button onClick={() => removeQuickAction(idx)} className="p-2 text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={18}/></button>
                                                    </div>

                                                    {/* Color Picker Drawer */}
                                                    {quickActionColorPickerIdx === idx && (
                                                        <div className="mt-2 p-2 bg-slate-900 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-1">
                                                            <div className="flex flex-wrap gap-2 justify-start">
                                                                {COLORS.map(c => (
                                                                    <button
                                                                        key={c}
                                                                        onClick={() => {
                                                                            updateQuickAction(idx, 'color', c);
                                                                            setQuickActionColorPickerIdx(null);
                                                                        }}
                                                                        className={`w-6 h-6 rounded-full shadow-sm border ${action.color === c ? 'border-white scale-110 ring-1 ring-white/50' : 'border-transparent opacity-80 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/30' : ''}`}
                                                                        style={{ backgroundColor: c }}
                                                                    />
                                                                ))}
                                                                <button
                                                                    onClick={() => {
                                                                        updateQuickAction(idx, 'color', undefined);
                                                                        setQuickActionColorPickerIdx(null);
                                                                    }}
                                                                    className={`w-6 h-6 rounded-full shadow-sm border flex items-center justify-center bg-slate-800 ${!action.color ? 'border-white scale-110' : 'border-slate-600 text-slate-500'}`}
                                                                    title="重置為預設"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={addQuickAction} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2 text-sm">
                                            <Plus size={16} /> 新增按鈕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Rounding Mode Toggle */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">小數點處理</label>
                        <ToggleSwitch 
                            checked={isRoundingEnabled} 
                            onChange={toggleRounding}
                            label="啟用小數點進位/捨去"
                        />
                        {isRoundingEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-2 pt-2 pl-2 border-l-2 border-slate-700 ml-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['floor', 'ceil', 'round'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setEditedCol({...editedCol, rounding: mode})}
                                            className={`py-2 px-1 rounded-lg border text-xs font-bold ${editedCol.rounding === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                        >
                                            {mode === 'floor' ? '無條件捨去' :
                                             mode === 'ceil' ? '無條件進位' :
                                             '四捨五入'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'mapping' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                        <p className="text-sm text-slate-400">
                            設定數值區間與對應分數，或是在區間內每a加b。
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label>
                            <input 
                                type="text" 
                                value={editedCol.unit || ''} 
                                onChange={e => setEditedCol({...editedCol, unit: e.target.value})}
                                onFocus={e => e.target.select()}
                                placeholder="如：分、個、元"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {editedCol.mappingRules?.map((rule, idx) => {
                            const minConstraint = getMinConstraint(idx, editedCol.mappingRules || []);
                            const maxConstraint = rule.min;
                            const isNext = rule.max === 'next';
                            
                            // Calculate hint for 'Next' rules
                            let nextHint: { max: number, score: number, base?: number, increments?: number } | null = null;
                            if (isNext) {
                                const nextRule = editedCol.mappingRules?.[idx + 1];
                                if (nextRule && typeof nextRule.min === 'number') {
                                    const effectiveMax = nextRule.min - 1;

                                    // 修正：強制將預覽用的欄位型態設為 number，並啟用 useMapping (無論當前設定為何)。
                                    // 這樣能確保即使目前 useMapping=false (在基本分頁)，預覽時仍能看到查表結果。
                                    const previewCol: ScoreColumn = { ...editedCol, type: 'number', useMapping: true };

                                    // Calculate what the score would be at this effective max
                                    // We need to pass the current state of editedCol to calculate correctly based on live data
                                    const valAtMax = calculateColumnScore(previewCol, effectiveMax);
                                    
                                    // Calculate base breakdown if linear to prove to the user that we are using the previous rules
                                    let base, increments;
                                    if (rule.isLinear) {
                                        const prevEnd = (rule.min ?? 0) - 1;
                                        // Base score is strictly what the score WAS before this rule started applying
                                        base = calculateColumnScore(previewCol, prevEnd);
                                        increments = valAtMax - base;
                                    }
                                    
                                    nextHint = { max: effectiveMax, score: valAtMax, base, increments };
                                }
                            }

                            return (
                                <div key={idx} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 relative">
                                    <div className="flex items-center gap-2">
                                        {/* Min Input - Unified Width w-14 */}
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            placeholder="最小" 
                                            value={rule.min ?? ''} 
                                            // 移除 HTML min 屬性，改用 state 邏輯控制
                                            onChange={e => {
                                                const val = e.target.value;
                                                // Allow decimal intermediate state
                                                if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                    updateMappingRule(idx, 'min', val as any);
                                                } else {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) updateMappingRule(idx, 'min', num);
                                                }
                                            }}
                                            onFocus={e => e.target.select()}
                                            className="w-14 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white text-sm outline-none focus:border-emerald-500"
                                        />
                                        <span className="text-slate-500">~</span>
                                        {/* Max Input - Unified Width w-14 */}
                                        <div className="relative w-14">
                                            {isNext ? (
                                                <div 
                                                    className="w-full h-full bg-slate-800 border border-slate-700/50 rounded px-0.5 py-0.5 text-center flex flex-col items-center justify-center overflow-hidden cursor-help"
                                                    title={nextHint ? `在此區間結束時 (${nextHint.max}):\n總分: ${nextHint.score}${nextHint.base !== undefined ? `\n(基礎分 ${nextHint.base} + 累加分 ${nextHint.increments})` : ''}` : ''}
                                                >
                                                    <span className="text-xs font-bold text-indigo-300/80 uppercase tracking-tighter leading-none mb-0.5">自動</span>
                                                    {nextHint && (
                                                        <span className="text-[11px] text-indigo-100 font-mono leading-none whitespace-nowrap flex items-center justify-center w-full">
                                                            <span className="opacity-70 mr-px text-[9px]">最高</span>
                                                            {nextHint.max}
                                                            <span className="text-indigo-500 font-bold mx-[1px]">→</span>
                                                            {nextHint.score}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    inputMode="decimal"
                                                    placeholder="最大" 
                                                    value={rule.max ?? ''} 
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        // Allow decimal intermediate state
                                                        if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                            updateMappingRule(idx, 'max', val as any);
                                                        } else {
                                                            const num = parseFloat(val);
                                                            if (!isNaN(num)) updateMappingRule(idx, 'max', num);
                                                        }
                                                    }}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"
                                                />
                                            )}
                                            {rule.max === undefined && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500">
                                                    <InfinityIcon size={14} />
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Compact Vertical Toggle Button */}
                                        <button 
                                            onClick={() => idx !== 0 && updateMappingRule(idx, 'isLinear', !rule.isLinear)}
                                            disabled={idx === 0}
                                            className={`w-8 h-[38px] flex flex-col items-center justify-center gap-0.5 rounded-md shrink-0 transition-colors ${idx === 0 ? 'bg-slate-900 border border-slate-700/50 cursor-not-allowed border-dashed' : 'bg-slate-800 border border-slate-600 active:bg-slate-700'}`}
                                            title={idx === 0 ? "首項必須為固定分數（基準）" : (rule.isLinear ? "模式：每a加b" : "模式：固定分數")}
                                        >
                                            {idx === 0 ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <ArrowRightIcon size={12} className="text-emerald-400" />
                                                    <Lock size={10} className="text-slate-600" />
                                                </div>
                                            ) : (
                                                <>
                                                    <ArrowRightIcon 
                                                        size={12} 
                                                        className={`transition-all ${!rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} 
                                                    />
                                                    <TrendingUp 
                                                        size={12} 
                                                        className={`transition-all ${rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} 
                                                    />
                                                </>
                                            )}
                                        </button>

                                        {/* Score Input Area */}
                                        <div className="flex-1 min-w-0">
                                            {rule.isLinear ? (
                                                <div className="grid grid-cols-2 gap-1 h-[38px]">
                                                    {/* Unit Input */}
                                                    <div className="relative bg-slate-900 border border-slate-600 rounded-md flex items-center overflow-hidden">
                                                        <span className="absolute left-2 text-[10px] text-slate-500 font-bold z-10 pointer-events-none">每</span>
                                                        <input 
                                                            type="text"
                                                            inputMode="decimal" 
                                                            value={rule.unit ?? 1} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                // Allow decimal intermediate state
                                                                if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                                    updateMappingRule(idx, 'unit', val as any);
                                                                } else {
                                                                    const num = parseFloat(val);
                                                                    if (!isNaN(num)) updateMappingRule(idx, 'unit', num);
                                                                }
                                                            }}
                                                            onFocus={e => e.target.select()}
                                                            className="w-full h-full bg-transparent text-white text-center text-sm pl-4 pr-1 outline-none font-medium"
                                                        />
                                                    </div>
                                                    {/* Score Input */}
                                                    <div className="relative bg-slate-900 border border-emerald-500/30 rounded-md flex items-center overflow-hidden">
                                                        <span className="absolute left-2 text-[10px] text-emerald-500 font-bold z-10 pointer-events-none">加</span>
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={rule.score} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                // Allow decimal intermediate state
                                                                if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                                    updateMappingRule(idx, 'score', val as any);
                                                                } else {
                                                                    const num = parseFloat(val);
                                                                    if (!isNaN(num)) updateMappingRule(idx, 'score', num);
                                                                }
                                                            }}
                                                            onFocus={e => e.target.select()}
                                                            className="w-full h-full bg-transparent text-emerald-400 font-bold text-center text-sm pl-4 pr-1 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative w-full h-[38px]">
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        placeholder="分" 
                                                        value={rule.score} 
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            // Allow decimal intermediate state
                                                            if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                                updateMappingRule(idx, 'score', val as any);
                                                            } else {
                                                                const num = parseFloat(val);
                                                                if (!isNaN(num)) updateMappingRule(idx, 'score', num);
                                                            }
                                                        }}
                                                        onFocus={e => e.target.select()}
                                                        className="w-full h-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-bold rounded-md p-2 text-center text-sm outline-none focus:border-emerald-500"
                                                    />
                                                    <span className="absolute right-2 top-2.5 text-xs text-emerald-500/50">分</span>
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={() => removeMappingRule(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={addMappingRule} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2">
                        <Plus size={18} /> 新增區間
                    </button>
                </div>
            )}

            {activeTab === 'select' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                        <p className="text-sm text-slate-400">
                            建立固定的選項列表，點按選擇對應到分數。
                        </p>
                         <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-400 uppercase">按鈕欄數</label>
                                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                    {[1, 2, 3, 4].map(cols => (
                                        <button
                                            key={cols}
                                            onClick={() => setEditedCol({ ...editedCol, buttonGridColumns: cols })}
                                            className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                                                (editedCol.buttonGridColumns || 1) === cols 
                                                    ? 'bg-slate-600 text-white' 
                                                    : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {cols}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500">
                                {(editedCol.buttonGridColumns || 1) === 1 
                                    ? '目前為「清單模式」：按鈕將橫向排列，最適合閱讀。' 
                                    : '目前為「網格模式」：按鈕將縱向堆疊，節省空間。'
                                }
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-800">
                        <label className="text-xs font-bold text-slate-400 uppercase">選項列表</label>
                        {editedCol.options?.map((opt, idx) => (
                            <div key={idx} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectOptionColorPickerIdx(selectOptionColorPickerIdx === idx ? null : idx)}
                                        className="w-9 h-9 shrink-0 rounded-lg border border-slate-600 flex items-center justify-center shadow-sm relative overflow-hidden"
                                        style={{ backgroundColor: opt.color || editedCol.color || '#ffffff' }}
                                        title="設定按鈕顏色"
                                    >
                                        <Palette size={14} className={isColorDark(opt.color || editedCol.color || '#ffffff') ? 'text-white/80' : 'text-black/50'} />
                                    </button>
                                    <input 
                                        type="text" placeholder="選項說明文字" value={opt.label} 
                                        onChange={e => updateOption(idx, 'label', e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600"
                                    />
                                    <div className="relative w-24">
                                         <input 
                                            type="text" 
                                            inputMode="decimal"
                                            placeholder="0" 
                                            value={opt.value} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                // Allow decimal intermediate state
                                                if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                                                    updateOption(idx, 'value', val as any);
                                                } else {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) updateOption(idx, 'value', num);
                                                }
                                            }}
                                            onFocus={e => e.target.select()}
                                            className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-3 text-right outline-none focus:border-emerald-500"
                                        />
                                        <span className="absolute left-2 top-2.5 text-xs text-slate-500">分</span>
                                    </div>
                                    <button onClick={() => removeOption(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                                </div>
                                {selectOptionColorPickerIdx === idx && (
                                    <div className="mt-1 p-2 bg-slate-900 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-1">
                                        <div className="flex flex-wrap gap-2 justify-start">
                                            {COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => {
                                                        updateOption(idx, 'color', c);
                                                        setSelectOptionColorPickerIdx(null);
                                                    }}
                                                    className={`w-6 h-6 rounded-full shadow-sm border ${opt.color === c ? 'border-white scale-110 ring-1 ring-white/50' : 'border-transparent opacity-80 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/30' : ''}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                            <button
                                                onClick={() => {
                                                    updateOption(idx, 'color', undefined);
                                                    setSelectOptionColorPickerIdx(null);
                                                }}
                                                className={`w-6 h-6 rounded-full shadow-sm border flex items-center justify-center bg-slate-800 ${!opt.color ? 'border-white scale-110' : 'border-slate-600 text-slate-500'}`}
                                                title="重置為預設"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <button onClick={addOption} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2">
                        <Plus size={18} /> 新增選項
                    </button>
                </div>
            )}
          </div>
      </div>

      {/* Footer - Hides when keyboard is open on mobile */}
      {!isKeyboardOpen && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex-none z-20 animate-in slide-in-from-bottom-2 duration-200">
              <button onClick={handleSave} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2">
                  <Save size={20} /> 儲存設定
              </button>
          </div>
      )}
    </div>
  );
};

export default ColumnConfigEditor;

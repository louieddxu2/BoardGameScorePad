
import React, { useState, useEffect, useRef } from 'react';
import { ScoreColumn, SelectOption, MappingRule, QuickAction, InputMethod } from '../../types';
import { calculateColumnScore } from '../../utils/scoring';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Plus, Trash2, BoxSelect, PlusSquare, Keyboard, MousePointerClick, Palette, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, LayoutGrid, LayoutList, ArrowUp, TrendingUp, Ban, ArrowUpToLine, Infinity as InfinityIcon, ArrowRight as ArrowRightIcon, Lock } from 'lucide-react';
import { COLORS } from '../../constants';

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
  // Local state for editing
  const [editedCol, setEditedCol] = useState<ScoreColumn>(() => {
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
    // This is a one-time migration during edit.
    let rules = column.mappingRules ? [...column.mappingRules] : [];
    
    // Check if we need to migrate legacy overflow settings
    // Logic: If the last rule is finite, and there are legacy settings, append a new Infinite Linear rule
    let maxBoundary = -Infinity;
    let lastRuleIsInfinite = false;
    rules.forEach((r, idx) => {
          let eMax = r.max === 'next' ? (rules[idx+1]?.min ? rules[idx+1].min! - 1 : Infinity) : (r.max ?? Infinity);
          if (eMax > maxBoundary) maxBoundary = eMax;
          if (eMax === Infinity) lastRuleIsInfinite = true;
    });

    if (!lastRuleIsInfinite && maxBoundary > -Infinity && column.mappingStrategy === 'linear') {
        // Migration: Append a new rule starting from maxBoundary + 1
        rules.push({
            min: maxBoundary + 1,
            max: undefined, // Infinity
            score: column.linearScore ?? 1,
            isLinear: true,
            unit: column.linearUnit ?? 1
        });
        // We effectively clear the legacy flags by not using them, but we don't delete them from data until save
    }

    // NEW: Enforce first rule is always fixed (non-linear)
    // 這是為了避免 "0" 被視為 "每 1 加 1" 的第一個區間，導致從 -1 開始計算
    if (rules.length > 0 && rules[0].isLinear) {
        rules[0] = { ...rules[0], isLinear: false };
    }

    return { 
        ...column, 
        mappingRules: rules,
    };
  });

  const [activeTab, setActiveTab] = useState<EditorTab>(() => {
      if (column.type === 'select' || column.type === 'boolean') return 'select';
      if (column.mappingRules && column.mappingRules.length > 0) return 'mapping';
      return 'basic';
  });
  
  // State to track if virtual keyboard is likely open (based on viewport height)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  // Store the initial height to compare against
  const initialHeight = useRef(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
        const currentHeight = window.innerHeight;
        
        // Dynamic Reference Update:
        if (currentHeight > initialHeight.current) {
            initialHeight.current = currentHeight;
        }

        // Keyboard Detection Logic:
        const isOpen = currentHeight < initialHeight.current * 0.75;
        setIsKeyboardOpen(isOpen);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSave = () => {
    // When saving, ensure the type matches the active tab mode
    let finalUpdates: Partial<ScoreColumn> = { ...editedCol };
    
    if (activeTab === 'mapping') {
        finalUpdates.type = 'number';
        finalUpdates.calculationType = 'standard'; // Mapping overrides product logic
        if (!finalUpdates.mappingRules) finalUpdates.mappingRules = [];
        
        // Remove legacy overflow fields if we have fully migrated to rules
        // We keep them undefined/null to clean up
        finalUpdates.mappingStrategy = undefined;
        finalUpdates.linearUnit = undefined;
        finalUpdates.linearScore = undefined;
        
    } else if (activeTab === 'select') {
        finalUpdates.type = 'select';
        finalUpdates.calculationType = 'standard';
    } else {
        // Basic tab -> Type Number
        finalUpdates.type = 'number';
        finalUpdates.mappingRules = [];
        
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
      const newAction: QuickAction = { id: crypto.randomUUID(), label: '', value: 1, color: editedCol.color, isModifier: false };
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
           updates.quickActions = [{ id: crypto.randomUUID(), label: '範例按鈕', value: 1, color: editedCol.color }];
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
        // Note: onFocusCapture removed to allow desktop use. 
        // Virtual Keyboard detection is now handled solely by window.innerHeight resize events in useEffect.
    >
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
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"><X size={20}/></button>
          </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
          
          {/* Global Config Section */}
          <div className="p-4 bg-slate-900/50 space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">欄位名稱</label>
                  <input 
                    type="text" 
                    value={editedCol.name} 
                    onChange={e => setEditedCol({...editedCol, name: e.target.value})}
                    onFocus={e => e.target.select()}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
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
              <TabButton id="basic" label="基本設定" icon={Calculator} />
              <TabButton id="mapping" label="查表設定" icon={Ruler} />
              <TabButton id="select" label="選項設定" icon={ListPlus} />
          </div>

          {/* Tab Content */}
          <div className="p-4">
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
                                    type="number" 
                                    value={editedCol.weight ?? 1} 
                                    onChange={e => setEditedCol({...editedCol, weight: parseFloat(e.target.value)})}
                                    onFocus={e => e.target.select()}
                                    className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded"
                                />
                                <span className="text-slate-600">=</span>
                                <span className="text-white font-bold">得分</span>
                            </div>
                        </div>
                    )}

                    {/* Input Method Toggle */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入方式</label>
                        <ToggleSwitch 
                            checked={isClickerEnabled} 
                            onChange={toggleInputMethod}
                            label="啟用按鈕面板 (Clicker)"
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
                                {/* Quick Button List (Omitted for brevity, logic remains same) */}
                                <div className="border-t border-slate-700/50 pt-4 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">按鈕列表</label>
                                    {editedCol.quickActions?.map((action, idx) => (
                                        <div key={action.id} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                            <button
                                                onClick={() => updateQuickAction(idx, 'isModifier', !action.isModifier)}
                                                className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                                                    action.isModifier 
                                                        ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/10 text-indigo-400' 
                                                        : 'border border-slate-600 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400'
                                                }`}
                                            >
                                                <Plus size={18} strokeWidth={action.isModifier ? 3 : 2} />
                                            </button>
                                            <div className="flex-1 flex gap-2 min-w-0">
                                                <input 
                                                    type="text" placeholder="標籤" value={action.label}
                                                    onChange={e => updateQuickAction(idx, 'label', e.target.value)}
                                                    className="flex-1 min-w-[60px] bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"
                                                />
                                                <div className="relative w-14 shrink-0">
                                                    <input 
                                                        type="number" placeholder="0" value={action.value}
                                                        onChange={e => updateQuickAction(idx, 'value', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-2 text-right text-sm outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => removeQuickAction(idx)} className="p-2 text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={addQuickAction} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2 text-sm">
                                    <Plus size={16} /> 新增按鈕
                                </button>
                            </div>
                        )}
                    </div>

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
                            設定數值區間與對應分數，系統將優先使用此規則。
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
                            let nextHint: { max: number, score: number } | null = null;
                            if (isNext) {
                                const nextRule = editedCol.mappingRules?.[idx + 1];
                                if (nextRule && typeof nextRule.min === 'number') {
                                    const effectiveMax = nextRule.min - 1;
                                    // Calculate what the score would be at this effective max
                                    // We need to pass the current state of editedCol to calculate correctly based on live data
                                    const valAtMax = calculateColumnScore(editedCol, effectiveMax);
                                    nextHint = { max: effectiveMax, score: valAtMax };
                                }
                            }

                            return (
                                <div key={idx} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 relative">
                                    <div className="flex items-center gap-2">
                                        {/* Min Input - Unified Width w-14 */}
                                        <input 
                                            type="number" 
                                            placeholder="最小" 
                                            value={rule.min ?? ''} 
                                            min={minConstraint}
                                            onChange={e => updateMappingRule(idx, 'min', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            onFocus={e => e.target.select()}
                                            className="w-14 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white text-sm"
                                        />
                                        <span className="text-slate-500">~</span>
                                        {/* Max Input - Unified Width w-14 */}
                                        <div className="relative w-14">
                                            {isNext ? (
                                                <div className="w-full h-full bg-slate-800 border border-slate-700/50 rounded px-0.5 py-0.5 text-center flex flex-col items-center justify-center overflow-hidden">
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
                                                    type="number" 
                                                    placeholder="最大" 
                                                    value={rule.max ?? ''} 
                                                    min={maxConstraint}
                                                    onChange={e => updateMappingRule(idx, 'max', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white placeholder-slate-600 text-sm"
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
                                            title={idx === 0 ? "首項必須為固定數值（基準）" : (rule.isLinear ? "模式：線性累加" : "模式：固定分數")}
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
                                                            type="number" 
                                                            value={rule.unit ?? 1} 
                                                            onChange={e => updateMappingRule(idx, 'unit', parseFloat(e.target.value))}
                                                            onFocus={e => e.target.select()}
                                                            className="w-full h-full bg-transparent text-white text-center text-sm pl-4 pr-1 outline-none font-medium"
                                                        />
                                                    </div>
                                                    {/* Score Input */}
                                                    <div className="relative bg-slate-900 border border-emerald-500/30 rounded-md flex items-center overflow-hidden">
                                                        <span className="absolute left-2 text-[10px] text-emerald-500 font-bold z-10 pointer-events-none">加</span>
                                                        <input 
                                                            type="number" 
                                                            value={rule.score} 
                                                            onChange={e => updateMappingRule(idx, 'score', parseFloat(e.target.value))}
                                                            onFocus={e => e.target.select()}
                                                            className="w-full h-full bg-transparent text-emerald-400 font-bold text-center text-sm pl-4 pr-1 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative w-full h-[38px]">
                                                    <input 
                                                        type="number" placeholder="分" value={rule.score} 
                                                        onChange={e => updateMappingRule(idx, 'score', parseFloat(e.target.value))}
                                                        onFocus={e => e.target.select()}
                                                        className="w-full h-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-bold rounded-md p-2 text-center text-sm"
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
                        <Plus size={18} /> 新增規則
                    </button>
                </div>
            )}

            {activeTab === 'select' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                        建立固定的選項清單。每個選項代表一個特定的分數。
                    </p>
                    <div className="space-y-2">
                        {editedCol.options?.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                <div className="relative w-24">
                                     <input 
                                        type="number" placeholder="0" value={opt.value} 
                                        onChange={e => updateOption(idx, 'value', parseFloat(e.target.value) || 0)}
                                        onFocus={e => e.target.select()}
                                        className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-3 text-right"
                                    />
                                    <span className="absolute left-2 top-2.5 text-xs text-slate-500">分</span>
                                </div>
                                
                                <input 
                                    type="text" placeholder="選項說明 (如: 第一名)" value={opt.label} 
                                    onChange={e => updateOption(idx, 'label', e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600"
                                />
                                <button onClick={() => removeOption(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
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

      {/* Footer */}
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
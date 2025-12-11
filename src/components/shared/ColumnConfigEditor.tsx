
import React, { useState, useEffect } from 'react';
import { ScoreColumn, SelectOption, MappingRule, QuickAction, InputMethod } from '../../types';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Plus, Trash2, BoxSelect, PlusSquare, Keyboard, MousePointerClick, Palette, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, LayoutGrid, LayoutList, ArrowUp, TrendingUp, Ban, ArrowUpToLine, Infinity as InfinityIcon, ArrowRight as ArrowRightIcon } from 'lucide-react';
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
    
    // Ensure default strategy
    return { 
        ...column, 
        mappingStrategy: column.mappingStrategy || 'linear',
        linearUnit: column.linearUnit ?? 1,
        linearScore: column.linearScore ?? 1,
    };
  });

  const [activeTab, setActiveTab] = useState<EditorTab>(() => {
      if (column.type === 'select' || column.type === 'boolean') return 'select';
      if (column.mappingRules && column.mappingRules.length > 0) return 'mapping';
      return 'basic';
  });

  const handleSave = () => {
    // When saving, ensure the type matches the active tab mode
    let finalUpdates: Partial<ScoreColumn> = { ...editedCol };
    
    if (activeTab === 'mapping') {
        finalUpdates.type = 'number';
        finalUpdates.calculationType = 'standard'; // Mapping overrides product logic
        if (!finalUpdates.mappingRules) finalUpdates.mappingRules = [];
        
        // Ensure overflow settings are clean if switching away from mapping, 
        // but here we are IN mapping, so we keep them.
    } else if (activeTab === 'select') {
        finalUpdates.type = 'select';
        finalUpdates.calculationType = 'standard';
    } else {
        // Basic tab -> Type Number
        finalUpdates.type = 'number';
        finalUpdates.mappingRules = [];
        // Reset mapping specific fields to keep JSON clean (optional)
        finalUpdates.mappingStrategy = 'linear';
        
        // Ensure inputs are clean based on settings
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
  
  // Calculate the valid minimum for a given rule index based on the previous rule
  const getMinConstraint = (idx: number, rules: MappingRule[]): number => {
      if (idx === 0) return -999999; // Effectively no limit for the first rule, or could be 0
      const prevRule = rules[idx - 1];
      
      // Resolve Previous Rule's "Effective Max"
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
      let newValue = val;

      // 1. Enforce Min Constraint
      if (field === 'min' && typeof newValue === 'number') {
          const minLimit = getMinConstraint(idx, newRules);
          if (newValue < minLimit) newValue = minLimit;
      }

      // 2. Enforce Max Constraint
      if (field === 'max' && typeof newValue === 'number') {
          const currentMin = newRules[idx].min;
          if (currentMin !== undefined && newValue < currentMin) {
              newValue = currentMin;
          }
      }
      
      newRules[idx] = { ...newRules[idx], [field]: newValue };
      setEditedCol({ ...editedCol, mappingRules: newRules });
  };

  const addMappingRule = () => {
      const rules = [...(editedCol.mappingRules || [])];
      let newMin = 0; // Default to 0 for first rule
      let lastScore = 0;
      
      if (rules.length > 0) {
          const lastRule = rules[rules.length - 1];
          lastScore = lastRule.score;
          
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

      // New rule defaults to 'next' to represent open-ended until filled
      // Actually, user requested the 'back' part (Max) to be 'next' by default?
      // Re-reading: "新增時預設輸入「Next」" for the LATTER item (Max).
      // So new rule is { min: X, max: 'next' } effectively until user types a number.
      setEditedCol({ ...editedCol, mappingRules: [...rules, { min: newMin, max: undefined, score: lastScore }] });
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

      setEditedCol({ ...editedCol, mappingRules: newRules });
  };
  
  // Find the highest MAX value to display in the overflow section
  // Also check if the last rule is effectively infinite
  let maxBoundary = -Infinity;
  let isLastRuleInfinite = false;

  editedCol.mappingRules?.forEach((rule, idx, allRules) => {
      if (rule.max === 'next') {
          const nextRule = allRules[idx + 1];
          if (nextRule && typeof nextRule.min === 'number') {
              // It's linked, so it's finite
              if ((nextRule.min - 1) > maxBoundary) maxBoundary = nextRule.min - 1;
          } else {
               // 'next' but no next rule = infinite
               isLastRuleInfinite = true;
          }
      } else if (typeof rule.max === 'number') {
          if (rule.max > maxBoundary) maxBoundary = rule.max;
      } else {
          // undefined max = infinite
          isLastRuleInfinite = true;
      }
  });
  
  const showOverflowSettings = !isLastRuleInfinite && maxBoundary !== -Infinity;


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
      
      // If switching to clicker and no actions exist, add a default one
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
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-20">
          <div className="flex items-center gap-2">
              <div className="bg-slate-800 p-2 rounded text-emerald-500"><Settings size={20}/></div>
              <div>
                  <h2 className="text-white font-bold text-lg">編輯屬性</h2>
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
          
          {/* Global Config Section (Moved Up) */}
          <div className="p-4 bg-slate-900/50 space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">顯示名稱</label>
                  <input 
                    type="text" 
                    value={editedCol.name} 
                    onChange={e => setEditedCol({...editedCol, name: e.target.value})}
                    onFocus={e => e.target.select()}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                  />
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">標示顏色</label>
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
              <TabButton id="basic" label="一般運算" icon={Calculator} />
              <TabButton id="mapping" label="查表規則" icon={Ruler} />
              <TabButton id="select" label="選項清單" icon={ListPlus} />
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'basic' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Calculation Mode Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">運算模式</label>
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
                                    <div className="text-xs font-bold uppercase">一般加權</div>
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
                                    <div className="text-xs font-bold uppercase">分項加總</div>
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">乘積單位 (Sub-units)</label>
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位量詞 (Unit)</label>
                                <input 
                                    type="text" 
                                    value={editedCol.unit || ''} 
                                    onChange={e => setEditedCol({...editedCol, unit: e.target.value})}
                                    onFocus={e => e.target.select()}
                                    placeholder="例如: 分, 隻, 塊"
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
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入介面設定</label>
                        <ToggleSwitch 
                            checked={isClickerEnabled} 
                            onChange={toggleInputMethod}
                            label="啟用自訂按鈕輸入 (Clicker)"
                        />
                        
                        {isClickerEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-2 mt-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                                
                                {/* Layout Config */}
                                <div className="flex items-center justify-between">
                                     <label className="text-xs font-bold text-slate-400 uppercase">按鈕排列欄數</label>
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
                                        <div key={action.id} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                            
                                            {/* Modifier Toggle (Moved to Left) */}
                                            <button
                                                onClick={() => updateQuickAction(idx, 'isModifier', !action.isModifier)}
                                                className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                                                    action.isModifier 
                                                        ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/10 text-indigo-400' 
                                                        : 'border border-slate-600 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400'
                                                }`}
                                                title={action.isModifier ? "修飾模式：數值將加總至上一筆紀錄" : "一般模式：新增一筆紀錄"}
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
                                            
                                            {/* Color Picker Mini */}
                                            <div className="relative group shrink-0">
                                                <button className="w-8 h-8 rounded-full border-2 border-slate-600 flex items-center justify-center" style={{ backgroundColor: action.color || editedCol.color || '#3b82f6' }}>
                                                    <Palette size={14} className="text-white/80" />
                                                </button>
                                                <div className="absolute right-0 bottom-full mb-2 bg-slate-800 border border-slate-700 p-2 rounded-lg shadow-xl grid grid-cols-4 gap-1 w-32 hidden group-hover:grid group-focus-within:grid z-50">
                                                    {COLORS.slice(0, 8).map(c => (
                                                        <button 
                                                            key={c} 
                                                            onClick={() => updateQuickAction(idx, 'color', c)}
                                                            className="w-6 h-6 rounded-full border border-slate-600" 
                                                            style={{backgroundColor: c}}
                                                        />
                                                    ))}
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
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">進位設定</label>
                        <ToggleSwitch 
                            checked={isRoundingEnabled} 
                            onChange={toggleRounding}
                            label="啟用進位/捨去規則"
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
                            設定數值區間與對應的分數。系統將優先使用查表結果。
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位量詞 (Unit)</label>
                            <input 
                                type="text" 
                                value={editedCol.unit || ''} 
                                onChange={e => setEditedCol({...editedCol, unit: e.target.value})}
                                onFocus={e => e.target.select()}
                                placeholder="例如: 分, 隻, 塊"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {editedCol.mappingRules?.map((rule, idx) => {
                            const minConstraint = getMinConstraint(idx, editedCol.mappingRules || []);
                            const maxConstraint = rule.min;
                            const isNext = rule.max === 'next';
                            
                            return (
                                <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                    <input 
                                        type="number" 
                                        placeholder="Min" 
                                        value={rule.min ?? ''} 
                                        min={minConstraint}
                                        onChange={e => updateMappingRule(idx, 'min', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        onFocus={e => e.target.select()}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white"
                                    />
                                    <span className="text-slate-500">~</span>
                                    <div className="relative w-16">
                                        {isNext ? (
                                            <div className="w-full h-full bg-slate-800 border border-slate-700/50 rounded p-2 text-center flex items-center justify-center">
                                                <span className="text-xs font-bold text-indigo-400 bg-indigo-900/20 px-1 rounded flex items-center gap-0.5">Next <ArrowRightIcon size={8} /></span>
                                            </div>
                                        ) : (
                                            <input 
                                                type="number" 
                                                placeholder="..." 
                                                value={rule.max ?? ''} 
                                                min={maxConstraint}
                                                onChange={e => updateMappingRule(idx, 'max', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                onFocus={e => e.target.select()}
                                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white placeholder-slate-600"
                                            />
                                        )}
                                        {rule.max === undefined && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500">
                                                <InfinityIcon size={14} />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-slate-500">➜</span>
                                    <div className="flex-1 relative">
                                        <input 
                                            type="number" placeholder="Score" value={rule.score} 
                                            onChange={e => updateMappingRule(idx, 'score', parseFloat(e.target.value))}
                                            onFocus={e => e.target.select()}
                                            className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-bold rounded p-2 text-center"
                                        />
                                        <span className="absolute right-2 top-2.5 text-xs text-emerald-500/50">分</span>
                                    </div>
                                    <button onClick={() => removeMappingRule(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={addMappingRule} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2">
                        <Plus size={18} /> 新增規則 (Next)
                    </button>
                    
                    {/* Overflow Strategy Section (Conditionally Rendered) */}
                    {showOverflowSettings && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-1">
                             <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-dashed border-slate-600/50">
                                {/* Boundary Indicator */}
                                <div className="w-16 flex items-center justify-center gap-1 bg-slate-900 border border-slate-600 rounded p-2 text-slate-400 select-none">
                                    <span className="text-xs font-bold text-emerald-500">{'>'} {maxBoundary}</span>
                                </div>
                                <span className="text-slate-500">➜</span>
                                
                                {/* Strategy Toggle */}
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shrink-0">
                                    <button
                                        onClick={() => setEditedCol({ ...editedCol, mappingStrategy: 'linear' })}
                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                            editedCol.mappingStrategy === 'linear' 
                                                ? 'bg-emerald-600 text-white shadow' 
                                                : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        線性
                                    </button>
                                    <button
                                        onClick={() => setEditedCol({ ...editedCol, mappingStrategy: 'zero' })}
                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                            editedCol.mappingStrategy === 'zero' 
                                                ? 'bg-slate-600 text-white shadow' 
                                                : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        無分
                                    </button>
                                </div>

                                {/* Linear Inputs */}
                                {editedCol.mappingStrategy === 'linear' ? (
                                    <div className="flex-1 flex items-center gap-1 ml-1 overflow-hidden">
                                        <span className="text-xs text-slate-400 whitespace-nowrap">每</span>
                                        <input 
                                            type="number" 
                                            value={editedCol.linearUnit ?? 1}
                                            onChange={e => setEditedCol({...editedCol, linearUnit: Math.max(1, parseFloat(e.target.value) || 1)})}
                                            onFocus={e => e.target.select()}
                                            className="w-10 bg-slate-900 border border-emerald-500/50 rounded p-1 text-center font-bold text-white text-xs focus:border-emerald-400 outline-none"
                                        />
                                        <span className="text-xs text-slate-400 whitespace-nowrap">{editedCol.unit || '單位'}</span>
                                        <span className="text-xs text-emerald-400 font-bold whitespace-nowrap">+</span>
                                        <input 
                                            type="number" 
                                            value={editedCol.linearScore ?? 1}
                                            onChange={e => setEditedCol({...editedCol, linearScore: parseFloat(e.target.value)})}
                                            onFocus={e => e.target.select()}
                                            className="w-10 bg-slate-900 border border-emerald-500/50 rounded p-1 text-center font-bold text-white text-xs focus:border-emerald-400 outline-none"
                                        />
                                        <span className="text-xs text-slate-400 whitespace-nowrap">分</span>
                                    </div>
                                ) : (
                                    <div className="flex-1 text-center text-xs text-slate-500 italic">
                                        超過 {maxBoundary} 不計分
                                    </div>
                                )}
                             </div>
                             <div className="text-[10px] text-slate-500 mt-2 px-1">
                                 {editedCol.mappingStrategy === 'linear' 
                                     ? `說明：超過 ${maxBoundary} 後，每多 ${editedCol.linearUnit ?? 1} ${editedCol.unit || '單位'}，就增加 ${editedCol.linearScore ?? 1} 分。`
                                     : `說明：輸入值超過 ${maxBoundary} 時，該項目將不獲得任何分數。`
                                 }
                             </div>
                        </div>
                    )}
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
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex-none z-20">
          <button onClick={handleSave} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2">
              <Save size={20} /> 儲存設定
          </button>
      </div>
    </div>
  );
};

export default ColumnConfigEditor;

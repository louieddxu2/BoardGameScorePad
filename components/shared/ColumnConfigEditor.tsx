
import React, { useState, useEffect } from 'react';
import { ScoreColumn, ColumnType, MappingRule, SelectOption, RoundingMode } from '../../types';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Plus, Trash2, BoxSelect, Palette } from 'lucide-react';
import { COLORS } from '../../src/constants';

interface ColumnConfigEditorProps {
  column: ScoreColumn;
  onSave: (updates: Partial<ScoreColumn>) => void;
  onDelete: () => void;
  onClose: () => void;
}

type EditorTab = 'basic' | 'mapping' | 'select';

// Helper to determine if a color is dark and needs a light text shadow for contrast
const isColorDark = (hex: string): boolean => {
    const darkColors = ['#a16207', '#6b7280', '#1f2937']; // Brown, Gray, Black
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
    return { ...column };
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
    } else if (activeTab === 'basic') {
        finalUpdates.type = 'number';
        finalUpdates.mappingRules = [];
        // calculationType is already set in state
    } else {
        finalUpdates.type = 'select';
        finalUpdates.calculationType = 'standard';
    }
    
    onSave(finalUpdates);
  };

  // --- Mapping Rule Helpers ---
  const updateMappingRule = (idx: number, field: keyof MappingRule, val: any) => {
      const newRules = [...(editedCol.mappingRules || [])];
      newRules[idx] = { ...newRules[idx], [field]: val };
      setEditedCol({ ...editedCol, mappingRules: newRules });
  };

  const addMappingRule = () => {
      setEditedCol({ ...editedCol, mappingRules: [...(editedCol.mappingRules || []), { score: 0 }] });
  };

  const removeMappingRule = (idx: number) => {
      setEditedCol({ ...editedCol, mappingRules: (editedCol.mappingRules || []).filter((_, i) => i !== idx) });
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900">
          <TabButton id="basic" label="一般運算" icon={Calculator} />
          <TabButton id="mapping" label="查表規則" icon={Ruler} />
          <TabButton id="select" label="選項清單" icon={ListPlus} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          <div className="mb-6 space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">顯示名稱</label>
                  <input 
                    type="text" 
                    value={editedCol.name} 
                    onChange={e => setEditedCol({...editedCol, name: e.target.value})}
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

              {/* Unit is relevant for number/basic/mapping */}
              {(activeTab === 'basic' || activeTab === 'mapping') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位量詞 (Unit)</label>
                    <input 
                        type="text" 
                        value={editedCol.unit || ''} 
                        onChange={e => setEditedCol({...editedCol, unit: e.target.value})}
                        placeholder={editedCol.calculationType === 'product' ? '最終分數位 (如: 分)' : '例如: 分, 隻, 塊'}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
              )}
          </div>

          <div className="border-t border-slate-800 pt-6">
            {activeTab === 'basic' && (
                <div className="space-y-6">
                    {/* Calculation Mode Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">運算模式</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setEditedCol({ ...editedCol, calculationType: 'standard' })}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    editedCol.calculationType !== 'product'
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
                                onClick={() => setEditedCol({ 
                                    ...editedCol, 
                                    calculationType: 'product',
                                    // Set default units if empty or switching to product mode
                                    subUnits: (editedCol.subUnits && editedCol.subUnits[0] && editedCol.subUnits[1]) ? editedCol.subUnits : ['分', '個']
                                })}
                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    editedCol.calculationType === 'product'
                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'
                                }`}
                            >
                                <BoxSelect size={24} />
                                <div className="leading-tight text-center">
                                    <div className="text-xs font-bold uppercase">乘積輸入</div>
                                    <div className="text-[10px] opacity-70">因子 A × B</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {editedCol.calculationType === 'product' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">A 的單位</label>
                                    <input 
                                        type="text" 
                                        value={editedCol.subUnits?.[0] || ''}
                                        onChange={e => setEditedCol({ ...editedCol, subUnits: [e.target.value, editedCol.subUnits?.[1] || ''] })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">B 的單位</label>
                                    <input 
                                        type="text" 
                                        value={editedCol.subUnits?.[1] || ''}
                                        onChange={e => setEditedCol({ ...editedCol, subUnits: [editedCol.subUnits?.[0] || '', e.target.value] })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-2">
                                <span className="text-slate-400 text-sm">{editedCol.subUnits?.[0] || 'A'}</span>
                                <span className="text-emerald-500 font-bold">×</span>
                                <span className="text-slate-400 text-sm">{editedCol.subUnits?.[1] || 'B'}</span>
                                <span className="text-slate-600">=</span>
                                <span className="text-white font-bold">總分</span>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-3 animate-in fade-in">
                            <span className="text-slate-400 text-sm">輸入值</span>
                            <span className="text-slate-600">×</span>
                            <input 
                                type="number" 
                                value={editedCol.weight ?? 1} 
                                onChange={e => setEditedCol({...editedCol, weight: parseFloat(e.target.value)})}
                                className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded"
                            />
                            <span className="text-slate-600">=</span>
                            <span className="text-white font-bold">得分</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">進位模式</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['none', 'floor', 'ceil', 'round'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setEditedCol({...editedCol, rounding: mode})}
                                    className={`p-3 rounded-lg border text-sm ${editedCol.rounding === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                >
                                    {mode === 'none' ? '無' : 
                                     mode === 'floor' ? '無條件捨去' :
                                     mode === 'ceil' ? '無條件進位' :
                                     mode === 'round' ? '四捨五入' : mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'mapping' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                        設定數值區間與對應的分數。系統將優先使用查表結果。
                    </p>
                    <div className="space-y-2">
                        {editedCol.mappingRules?.map((rule, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                <input 
                                    type="number" placeholder="Min" value={rule.min ?? ''} 
                                    onChange={e => updateMappingRule(idx, 'min', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-16 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white"
                                />
                                <span className="text-slate-500">~</span>
                                <input 
                                    type="number" placeholder="Max" value={rule.max ?? ''} 
                                    onChange={e => updateMappingRule(idx, 'max', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-16 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white"
                                />
                                <span className="text-slate-500">➜</span>
                                <div className="flex-1 relative">
                                    <input 
                                        type="number" placeholder="Score" value={rule.score} 
                                        onChange={e => updateMappingRule(idx, 'score', parseFloat(e.target.value))}
                                        className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-bold rounded p-2 text-center"
                                    />
                                    <span className="absolute right-2 top-2.5 text-xs text-emerald-500/50">分</span>
                                </div>
                                <button onClick={() => removeMappingRule(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addMappingRule} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2">
                        <Plus size={18} /> 新增規則
                    </button>
                </div>
            )}

            {activeTab === 'select' && (
                <div className="space-y-4">
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
                                        className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-3 text-right"
                                    />
                                    <span className="absolute left-2 top-2.5 text-xs text-slate-500">分</span>
                                </div>
                                
                                <input 
                                    type="text" placeholder="選項說明 (如: 第一名)" value={opt.label} 
                                    onChange={e => updateOption(idx, 'label', e.target.value)}
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
      <div className="p-4 bg-slate-900 border-t border-slate-800">
          <button onClick={handleSave} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2">
              <Save size={20} /> 儲存設定
          </button>
      </div>
    </div>
  );
};

export default ColumnConfigEditor;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScoreColumn, MappingRule, QuickAction, InputMethod } from '../../types';
import { calculateColumnScore } from '../../utils/scoring';
import { X, Ruler, Calculator, ListPlus, Settings, Save, Plus, Trash2, BoxSelect, PlusSquare, Palette, ArrowRight as ArrowRightIcon, Lock, Eye, EyeOff, Infinity as InfinityIcon, TrendingUp } from 'lucide-react';
import { COLORS } from '../../colors';
import { useVisualViewportOffset } from '../../hooks/useVisualViewportOffset';
import ConfirmationModal from './ConfirmationModal';

interface ColumnConfigEditorProps {
  column: ScoreColumn;
  onSave: (updates: Partial<ScoreColumn>) => void;
  onDelete: () => void;
  onDeleteAll?: () => void; // Unused for now
  onClose: () => void;
}

type EditorTab = 'basic' | 'mapping' | 'select';
type CalculationMode = 'standard' | 'sum-parts' | 'product';

const isColorDark = (hex: string): boolean => {
    const darkColors = ['#a16207', '#6b7280', '#1f2937', '#0f172a'];
    return darkColors.includes(hex.toLowerCase());
};

const ColumnConfigEditor: React.FC<ColumnConfigEditorProps> = ({ column, onSave, onDelete, onClose }) => {
  
  const getInitialState = (): ScoreColumn => {
    let rules = column.f1 ? [...column.f1] : [];
    // Ensure that if it's linear, we have unitScore initialized
    rules = rules.map(r => r.isLinear && r.unitScore === undefined ? { ...r, unitScore: r.score } : r);
    return { ...column, f1: rules };
  };

  const [editedCol, setEditedCol] = useState<ScoreColumn>(getInitialState);
  const initialStringifiedRef = useRef(JSON.stringify(getInitialState()));
  
  const getInitialTab = (col: ScoreColumn): EditorTab => {
    if ((col.formula || '').startsWith('f1')) return 'mapping';
    if (col.inputType === 'clicker' && !col.formula.includes('+next')) return 'select';
    return 'basic';
  };

  const [activeTab, setActiveTab] = useState<EditorTab>(() => getInitialTab(editedCol));
  const [quickActionColorPickerIdx, setQuickActionColorPickerIdx] = useState<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
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

  useEffect(() => {
      if (isKeyboardOpen) {
          const timer = setTimeout(() => {
              document.activeElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 300);
          return () => clearTimeout(timer);
      }
  }, [isKeyboardOpen]);

  const hasUnsavedChanges = () => JSON.stringify(editedCol) !== initialStringifiedRef.current;

  const handleAttemptClose = () => {
      if (hasUnsavedChanges()) setShowDiscardConfirm(true);
      else onClose();
  };

  useEffect(() => {
      const handleBackPress = (e: Event) => {
          e.stopImmediatePropagation();
          handleAttemptClose();
      };
      window.addEventListener('app-back-press', handleBackPress, { capture: true });
      return () => window.removeEventListener('app-back-press', handleBackPress, { capture: true });
  }, [editedCol]);

  const handleSave = () => {
      let finalUpdates: Partial<ScoreColumn> = { ...editedCol };
      
      if (activeTab === 'mapping') {
          finalUpdates.formula = 'f1(a1)';
          if (!finalUpdates.f1 || finalUpdates.f1.length === 0) finalUpdates.f1 = [{ min: 0, score: 0 }];
          finalUpdates.inputType = 'keypad';
          delete finalUpdates.constants;
      } else if (activeTab === 'select') {
          finalUpdates.formula = 'a1';
          finalUpdates.inputType = 'clicker';
          delete finalUpdates.f1;
          delete finalUpdates.constants;
      } else { 
          const currentMode = getCalculationMode(editedCol.formula);
          if (currentMode === 'product') {
              finalUpdates.formula = 'a1×a2';
              finalUpdates.inputType = 'keypad';
          } else if (currentMode === 'sum-parts') {
              finalUpdates.formula = 'a1+next';
              finalUpdates.inputType = editedCol.inputType || 'keypad';
          } else { 
              const weight = finalUpdates.constants?.c1 ?? 1;
              finalUpdates.formula = weight !== 1 ? 'a1×c1' : 'a1';
              finalUpdates.inputType = 'keypad';
          }
          delete finalUpdates.f1;
      }
      onSave(finalUpdates);
  };
  
  const getMinConstraint = (idx: number, rules: MappingRule[]): number => {
      if (idx === 0) return -999999;
      const prevRule = rules[idx - 1];
      let prevEnd = (prevRule.max === 'next') ? (prevRule.min ?? 0) : (prevRule.max ?? prevRule.min ?? 0);
      return prevEnd + 1;
  };

  const updateMappingRule = (idx: number, field: keyof MappingRule, val: any) => {
      const newRules = [...(editedCol.f1 || [])];
      let updatedRule = { ...newRules[idx] };
      
      if (field === 'isLinear' && idx > 0) {
          updatedRule.isLinear = val;
          // 當啟用線性時，預設單位為 1，並將目前的 score 作為 unitScore 基礎
          if (val) {
              updatedRule.unit = 1;
              updatedRule.unitScore = updatedRule.score || 1;
          } else {
              updatedRule.unit = undefined;
              updatedRule.unitScore = undefined;
          }
      } else {
          let newValue = val;
          if (field === 'min' && typeof newValue === 'number') newValue = Math.max(newValue, getMinConstraint(idx, newRules));
          if (field === 'max' && typeof newValue === 'number' && updatedRule.min !== undefined && newValue < updatedRule.min) newValue = updatedRule.min;
          if (field === 'unit' && typeof newValue === 'number') newValue = Math.max(1, newValue);
          updatedRule = { ...updatedRule, [field]: newValue };
      }
      newRules[idx] = updatedRule;
      setEditedCol({ ...editedCol, f1: newRules });
  };

  const addMappingRule = () => {
      const rules = [...(editedCol.f1 || [])];
      let newMin = 0; let lastScore = 0;
      if (rules.length > 0) {
          const lastRule = rules[rules.length - 1];
          lastScore = lastRule.score;
          newMin = (typeof lastRule.max === 'number' ? lastRule.max : lastRule.min ?? -1) + 1;
          rules[rules.length - 1] = { ...lastRule, max: 'next' };
      }
      setEditedCol({ ...editedCol, f1: [...rules, { min: newMin, max: undefined, score: lastScore, isLinear: false }] });
  };

  const removeMappingRule = (idx: number) => {
      let newRules = (editedCol.f1 || []).filter((_, i) => i !== idx);
      if (idx > 0 && idx === (editedCol.f1?.length || 0) - 1 && newRules[newRules.length - 1]?.max === 'next') {
          newRules[newRules.length - 1].max = undefined;
      }
      if (idx === 0 && newRules.length > 0) newRules[0].isLinear = false;
      setEditedCol({ ...editedCol, f1: newRules });
  };

  const addQuickAction = () => setEditedCol({ ...editedCol, quickActions: [...(editedCol.quickActions || []), { id: crypto.randomUUID(), label: '', value: 1, isModifier: false }] });
  const updateQuickAction = (idx: number, field: keyof QuickAction, val: any) => {
      const newActions = [...(editedCol.quickActions || [])];
      newActions[idx] = { ...newActions[idx], [field]: val };
      setEditedCol({ ...editedCol, quickActions: newActions });
  };
  const removeQuickAction = (idx: number) => setEditedCol({ ...editedCol, quickActions: (editedCol.quickActions || []).filter((_, i) => i !== idx) });
  
  const isRoundingEnabled = editedCol.rounding && editedCol.rounding !== 'none';
  const toggleRounding = () => setEditedCol({ ...editedCol, rounding: isRoundingEnabled ? 'none' : 'round' });
  
  const getCalculationMode = (formula: string): CalculationMode => {
      if (formula === 'a1×a2') return 'product';
      if ((formula || '').includes('+next')) return 'sum-parts';
      return 'standard';
  };
  const currentCalcMode = getCalculationMode(editedCol.formula);

  const setCalculationMode = (mode: CalculationMode) => {
      let formula = (mode === 'product') ? 'a1×a2' : (mode === 'sum-parts') ? 'a1+next' : ((editedCol.constants?.c1 ?? 1) !== 1 ? 'a1×c1' : 'a1');
      let updates: Partial<ScoreColumn> = { formula };
      if (mode === 'product') {
          updates.inputType = 'keypad';
          if (!editedCol.subUnits) updates.subUnits = ['分', '個'];
      } else if (mode === 'standard') {
          updates.inputType = 'keypad';
      }
      setEditedCol({ ...editedCol, ...updates });
  };

  const TabButton = ({ id, label, icon: Icon }: { id: EditorTab, label: string, icon: any }) => (
      <button onClick={() => setActiveTab(id)} className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors border-b-2 ${activeTab === id ? 'border-emerald-500 text-emerald-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
          <Icon size={18} />{label}
      </button>
  );

  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: string }) => (
      <div onClick={onChange} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors">
          <span className="text-sm font-bold text-slate-300">{label}</span>
          <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} /></div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-bottom-5" style={{ paddingBottom: visualViewportOffset }}>
      <ConfirmationModal isOpen={showDiscardConfirm} title="放棄變更？" message="您有未儲存的變更，離開後將會遺失。" confirmText="放棄並離開" cancelText="繼續編輯" isDangerous={true} onConfirm={onClose} onCancel={() => setShowDiscardConfirm(false)} />
      <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 flex-none z-20">
          <div className="flex items-center gap-2"><div className="bg-slate-800 p-2 rounded text-emerald-500"><Settings size={20}/></div><div><h2 className="text-white font-bold text-lg">編輯項目</h2><p className="text-xs text-slate-500">{editedCol.name}</p></div></div>
          <div className="flex items-center gap-2"><button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg border border-slate-700 hover:border-red-900/50" title="刪除此項目"><Trash2 size={20}/></button><button onClick={handleAttemptClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"><X size={20}/></button></div>
      </header>
      <main className="flex-1 overflow-y-auto no-scrollbar">
          <section className="p-4 bg-slate-900/50 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">欄位名稱</label><textarea ref={nameTextareaRef} rows={1} value={editedCol.name} onChange={e => setEditedCol({...editedCol, name: e.target.value})} onFocus={e => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none resize-none overflow-hidden"/></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">代表色</label><div className="flex items-center gap-2 flex-wrap">{COLORS.map(c => (<button key={c} onClick={() => setEditedCol({ ...editedCol, color: c })} className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${editedCol.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/50' : ''}`} style={{backgroundColor: c}} />))}<button onClick={() => setEditedCol({ ...editedCol, color: undefined })} className={`w-8 h-8 rounded-full shadow-lg border-2 flex items-center justify-center bg-slate-700 text-slate-400 transition-transform active:scale-90 ${!editedCol.color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}><X size={16}/></button></div></div>
          </section>
          <div className="sticky top-0 z-10 flex border-y border-slate-800 bg-slate-900 shadow-lg">
              <TabButton id="basic" label="數值運算" icon={Calculator} /><TabButton id="mapping" label="範圍查表" icon={Ruler} /><TabButton id="select" label="列表選單" icon={ListPlus} />
          </div>
          <div className="p-4 pb-24">{renderTabContent()}</div>
      </main>
      {!isKeyboardOpen && (
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 z-20" style={{ paddingBottom: `calc(1rem + ${visualViewportOffset}px)` }}>
              <button onClick={handleSave} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"><Save size={20} /> 儲存設定</button>
          </footer>
      )}
    </div>
  );

  function renderQuickActionsEditor(showModifierToggle: boolean) {
    return (
        <>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase">按鈕欄數</label>
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">{[1, 2, 3, 4].map(cols => ( <button key={cols} onClick={() => setEditedCol({ ...editedCol, buttonGridColumns: cols })} className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${(editedCol.buttonGridColumns || 1) === cols ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{cols}</button> ))}</div>
                </div>
                <div className="text-[10px] text-slate-500">{(editedCol.buttonGridColumns || 1) === 1 ? '目前為「清單模式」：按鈕將橫向排列，最適合閱讀。' : '目前為「網格模式」：按鈕將縱向堆疊，節省空間。'}</div>
            </div>
            <div className="border-t border-slate-700/50 pt-4 space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">按鈕列表</label>
                {editedCol.quickActions?.map((action, idx) => (
                    <div key={action.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700 transition-colors">
                        <div className="flex items-center gap-2">
                            {showModifierToggle && <button onClick={() => updateQuickAction(idx, 'isModifier', !action.isModifier)} className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${action.isModifier ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/10 text-indigo-400' : 'border border-slate-600 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400'}`} title="切換為額外添加鍵"><Plus size={18} strokeWidth={action.isModifier ? 3 : 2} /></button>}
                            <button onClick={() => setQuickActionColorPickerIdx(quickActionColorPickerIdx === idx ? null : idx)} className="w-9 h-9 shrink-0 rounded-lg border border-slate-600 flex items-center justify-center shadow-sm relative overflow-hidden" style={{ backgroundColor: action.color || editedCol.color || '#ffffff' }} title="設定按鈕顏色"><Palette size={14} className={isColorDark(action.color || editedCol.color || '#ffffff') ? 'text-white/80' : 'text-black/50'} /></button>
                            <div className="flex-1 flex gap-2 min-w-0">
                                <input type="text" placeholder="標籤" value={action.label} onChange={e => updateQuickAction(idx, 'label', e.target.value)} onFocus={e => e.target.select()} className="flex-1 min-w-[40px] bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"/>
                                <div className="relative w-14 shrink-0"><input type="text" inputMode="decimal" placeholder="0" value={action.value} onChange={e => { const str = e.target.value; if (str === '-' || str === '' || str.endsWith('.') || (str.includes('.') && str.endsWith('0'))) { updateQuickAction(idx, 'value', str as any); return; } const num = parseFloat(str); if (!isNaN(num)) { updateQuickAction(idx, 'value', num); } }} onFocus={e => e.target.select()} className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-2 text-right text-sm outline-none focus:border-emerald-500"/></div>
                            </div>
                            <button onClick={() => removeQuickAction(idx)} className="p-2 text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={18}/></button>
                        </div>
                        {quickActionColorPickerIdx === idx && (<div className="mt-2 p-2 bg-slate-900 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-1"><div className="flex flex-wrap gap-2 justify-start">{COLORS.map(c => ( <button key={c} onClick={() => { updateQuickAction(idx, 'color', c); setQuickActionColorPickerIdx(null); }} className={`w-6 h-6 rounded-full shadow-sm border ${action.color === c ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/30' : ''}`} style={{ backgroundColor: c }}/> ))}<button onClick={() => { updateQuickAction(idx, 'color', undefined); setQuickActionColorPickerIdx(null); }} className={`w-6 h-6 rounded-full shadow-sm border flex items-center justify-center bg-slate-800 ${!action.color ? 'border-white scale-110' : 'border-slate-600 text-slate-500'}`} title="重置為預設"><X size={12} /></button></div></div>)}
                    </div>
                ))}
            </div>
            <button onClick={addQuickAction} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2 text-sm"><Plus size={16} /> 新增按鈕</button>
        </>
    );
  }

  function renderTabContent() {
    switch(activeTab) {
        case 'mapping': return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4"><p className="text-sm text-slate-400">設定數值區間與對應分數，或是在區間內每a加b。</p><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label><input type="text" value={editedCol.unit || ''} onChange={e => setEditedCol({...editedCol, unit: e.target.value})} onFocus={e => e.target.select()} placeholder="如：分、個、元" className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 outline-none"/></div></div>
                <div className="space-y-2">{editedCol.f1?.map((rule, idx) => (<div key={idx} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 relative"><div className="flex items-center gap-2"><input type="text" inputMode="decimal" placeholder="最小" value={rule.min ?? ''} onChange={e => { const val = e.target.value; if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { updateMappingRule(idx, 'min', val as any); } else { const num = parseFloat(val); if (!isNaN(num)) updateMappingRule(idx, 'min', num); } }} onFocus={e => e.target.select()} className="w-14 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white text-sm outline-none focus:border-emerald-500"/><span className="text-slate-500">~</span><div className="relative w-14">{rule.max === 'next' ? <div className="w-full h-full bg-slate-800 border border-slate-700/50 rounded p-2 text-center flex items-center justify-center text-indigo-400 text-xs font-bold">NEXT</div> : <input type="text" inputMode="decimal" placeholder="最大" value={rule.max ?? ''} onChange={e => { const val = e.target.value; if (val === '') { updateMappingRule(idx, 'max', undefined); } else if (val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { updateMappingRule(idx, 'max', val as any); } else { const num = parseFloat(val); if (!isNaN(num)) updateMappingRule(idx, 'max', num); } }} onFocus={e => e.target.select()} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"/>}{rule.max === undefined && ( <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500"><InfinityIcon size={14} /></div> )}</div><button onClick={() => idx !== 0 && updateMappingRule(idx, 'isLinear', !rule.isLinear)} disabled={idx === 0} className={`w-8 h-[38px] flex flex-col items-center justify-center gap-0.5 rounded-md shrink-0 transition-colors ${idx === 0 ? 'bg-slate-900 border border-slate-700/50 cursor-not-allowed border-dashed' : 'bg-slate-800 border border-slate-600 active:bg-slate-700'}`} title={idx === 0 ? "首項必須為固定分數（基準）" : (rule.isLinear ? "模式：每a加b" : "模式：固定分數")}>{idx === 0 ? ( <div className="flex flex-col items-center gap-0.5"><ArrowRightIcon size={12} className="text-emerald-400" /><Lock size={10} className="text-slate-600" /></div> ) : ( <><ArrowRightIcon size={12} className={`transition-all ${!rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} /><TrendingUp size={12} className={`transition-all ${rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} /></> )}</button><div className="flex-1 min-w-0">{rule.isLinear ? (<div className="grid grid-cols-2 gap-1 h-[38px]"><div className="relative bg-slate-900 border border-slate-600 rounded-md flex items-center overflow-hidden"><span className="absolute left-2 text-[10px] text-slate-500 font-bold z-10 pointer-events-none">每</span><input type="text" inputMode="decimal" value={rule.unit ?? 1} onChange={e => { const val = e.target.value; if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { updateMappingRule(idx, 'unit', val as any); } else { const num = parseFloat(val); if (!isNaN(num)) updateMappingRule(idx, 'unit', num); } }} onFocus={e => e.target.select()} className="w-full h-full bg-transparent text-white text-center text-sm pl-4 pr-1 outline-none font-medium"/></div><div className="relative bg-slate-900 border border-emerald-500/30 rounded-md flex items-center overflow-hidden"><span className="absolute left-2 text-[10px] text-emerald-500 font-bold z-10 pointer-events-none">加</span><input type="text" inputMode="decimal" value={rule.unitScore !== undefined ? rule.unitScore : rule.score} onChange={e => { const val = e.target.value; if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { updateMappingRule(idx, 'unitScore', val as any); } else { const num = parseFloat(val); if (!isNaN(num)) updateMappingRule(idx, 'unitScore', num); } }} onFocus={e => e.target.select()} className="w-full h-full bg-transparent text-emerald-400 font-bold text-center text-sm pl-4 pr-1 outline-none"/></div></div>) : (<div className="relative w-full h-[38px]"><input type="text" inputMode="decimal" placeholder="分" value={rule.score} onChange={e => { const val = e.target.value; if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { updateMappingRule(idx, 'score', val as any); } else { const num = parseFloat(val); if (!isNaN(num)) updateMappingRule(idx, 'score', num); } }} onFocus={e => e.target.select()} className="w-full h-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-bold rounded-md p-2 text-center text-sm outline-none focus:border-emerald-500"/><span className="absolute right-2 top-2.5 text-xs text-emerald-500/50">分</span></div>)}</div><button onClick={() => removeMappingRule(idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button></div></div>))}</div><button onClick={addMappingRule} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2"><Plus size={18} /> 新增區間</button>
            </div>);
        case 'select': return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4"><p className="text-sm text-slate-400">建立固定的選項列表，點按選擇對應到分數。</p>{renderQuickActionsEditor(false)}</div>
            </div>);
        case 'basic':
        default: return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">計分模式</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => setCalculationMode('standard')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'standard' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><Calculator size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">基本加權</div><div className="text-[10px] opacity-70">數值 × 倍率</div></div></button>
                        <button onClick={() => setCalculationMode('sum-parts')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'sum-parts' ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(2,132,199,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><PlusSquare size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">分項累加</div><div className="text-[10px] opacity-70">1+2+3...</div></div></button>
                        <button onClick={() => setCalculationMode('product')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'product' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><BoxSelect size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">乘積輸入</div><div className="text-[10px] opacity-70"> A × B</div></div></button>
                    </div>
                </div>
                {currentCalcMode === 'product' ? (<div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">乘積單位</label><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] text-slate-400 mb-1"> A 的單位</label><input type="text" value={editedCol.subUnits?.[0] || ''} onChange={e => setEditedCol({ ...editedCol, subUnits: [e.target.value, editedCol.subUnits?.[1] || ''] })} onFocus={e => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"/></div><div><label className="block text-[10px] text-slate-400 mb-1"> B 的單位</label><input type="text" value={editedCol.subUnits?.[1] || ''} onChange={e => setEditedCol({ ...editedCol, subUnits: [editedCol.subUnits?.[0] || '', e.target.value] })} onFocus={e => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"/></div></div></div><div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-2"><span className="text-slate-400 text-sm">A</span><span className="text-emerald-500 font-bold">×</span><span className="text-slate-400 text-sm">B</span><span className="text-slate-600">=</span><span className="text-white font-bold">總分</span></div></div>) : (<div className={`space-y-4 animate-in fade-in slide-in-from-top-2 p-4 rounded-xl border ${currentCalcMode === 'sum-parts' ? 'bg-sky-900/10 border-sky-500/20' : 'bg-emerald-900/10 border-emerald-500/20'}`}><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label><input type="text" value={editedCol.unit || ''} onChange={e => setEditedCol({...editedCol, unit: e.target.value})} onFocus={e => e.target.select()} placeholder="如：分、個、元" className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"/></div>{currentCalcMode !== 'sum-parts' && (<div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-3"><span className="text-slate-400 text-sm">輸入值</span><span className="text-slate-600">×</span><input type="text" inputMode="decimal" value={editedCol.constants?.c1 ?? 1} onChange={e => { const val = e.target.value; if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { setEditedCol({...editedCol, constants: { ...editedCol.constants, c1: val as any }}); } else { const num = parseFloat(val); if (!isNaN(num)) setEditedCol({...editedCol, constants: { ...editedCol.constants, c1: num }}); } }} onFocus={e => e.target.select()} className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded outline-none focus:border-emerald-500"/><span className="text-slate-600">=</span><span className="text-white font-bold">得分</span></div>)}</div>)}
                {currentCalcMode === 'sum-parts' && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">格內顯示方式</label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                                <button onClick={() => setEditedCol({ ...editedCol, showPartsInGrid: true })} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${(editedCol.showPartsInGrid ?? true) === true ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><Eye size={14} /> 顯示各項</button>
                                <button onClick={() => setEditedCol({ ...editedCol, showPartsInGrid: false })} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${(editedCol.showPartsInGrid ?? true) === false ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><EyeOff size={14} /> 僅顯示總和</button>
                            </div>
                        </div>
                        
                        <div className="space-y-4 pt-4 border-t border-slate-800">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入方式</label>
                                <ToggleSwitch 
                                    checked={editedCol.inputType === 'clicker'} 
                                    onChange={() => setEditedCol({ ...editedCol, inputType: editedCol.inputType === 'clicker' ? 'keypad' : 'clicker' })} 
                                    label="啟用按鈕輸入面板" 
                                />
                                <p className="text-[10px] text-slate-500 px-1">
                                    {editedCol.inputType === 'clicker' 
                                        ? '目前模式：顯示自訂按鈕，適合固定數值累加。' 
                                        : '目前模式：使用數字鍵盤，適合輸入任意數值。'}
                                </p>
                            </div>

                            {editedCol.inputType === 'clicker' && (
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    {renderQuickActionsEditor(true)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div className="space-y-2 pt-4 border-t border-slate-800"><ToggleSwitch checked={isRoundingEnabled} onChange={toggleRounding} label="啟用小數點進位/捨去"/>{isRoundingEnabled && (<div className="animate-in fade-in slide-in-from-top-2 pt-2 pl-2 border-l-2 border-slate-700 ml-4"><div className="grid grid-cols-3 gap-2">{(['floor', 'ceil', 'round'] as const).map(mode => (<button key={mode} onClick={() => setEditedCol({...editedCol, rounding: mode})} className={`py-2 px-1 rounded-lg border text-xs font-bold ${editedCol.rounding === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{mode === 'floor' ? '無條件捨去' : mode === 'ceil' ? '無條件進位' : '四捨五入'}</button>))}</div></div>)}</div>
            </div>
        );
    }
  }
};

export default ColumnConfigEditor;

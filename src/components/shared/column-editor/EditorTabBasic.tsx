
import React, { useEffect } from 'react';
import { ScoreColumn, InputMethod } from '../../../types';
import { Calculator, BoxSelect, PlusSquare, Eye, EyeOff } from 'lucide-react';
import QuickActionsEditor from './QuickActionsEditor';

interface EditorTabBasicProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
  cachedSumPartsInputType: InputMethod;
  onUpdateCachedSumPartsInputType: (type: InputMethod) => void;
}

type CalculationMode = 'standard' | 'sum-parts' | 'product';

const EditorTabBasic: React.FC<EditorTabBasicProps> = ({ column, onChange, cachedSumPartsInputType, onUpdateCachedSumPartsInputType }) => {
  
  const getCalculationMode = (formula: string): CalculationMode => {
    if (formula === 'a1×a2') return 'product';
    if ((formula || '').includes('+next')) return 'sum-parts';
    return 'standard';
  };

  const currentCalcMode = getCalculationMode(column.formula);

  // Sync current input type to cache when in sum-parts mode
  useEffect(() => {
      if (currentCalcMode === 'sum-parts') {
          onUpdateCachedSumPartsInputType(column.inputType || 'keypad');
      }
  }, [currentCalcMode, column.inputType, onUpdateCachedSumPartsInputType]);

  const setCalculationMode = (mode: CalculationMode) => {
    let formula = (mode === 'product') ? 'a1×a2' : (mode === 'sum-parts') ? 'a1+next' : ((column.constants?.c1 ?? 1) !== 1 ? 'a1×c1' : 'a1');
    let updates: Partial<ScoreColumn> = { formula };
    
    if (mode === 'product') {
        updates.inputType = 'keypad';
        // Initialize subUnits if missing
        if (!column.subUnits || column.subUnits.length !== 2) {
            updates.subUnits = ['分', '個'];
        }
    } else if (mode === 'standard') {
        updates.inputType = 'keypad';
    } else if (mode === 'sum-parts') {
        // Restore previous preference for Sum Parts input from parent cache
        updates.inputType = cachedSumPartsInputType;
    }
    
    onChange(updates);
  };

  const isRoundingEnabled = column.rounding && column.rounding !== 'none';
  
  const toggleRounding = () => {
      onChange({ rounding: isRoundingEnabled ? 'none' : 'round' });
  };

  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: string }) => (
    <div onClick={onChange} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors">
        <span className="text-sm font-bold text-slate-300">{label}</span>
        <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} /></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Mode Switcher */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">計分模式</label>
            <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setCalculationMode('standard')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'standard' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><Calculator size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">基本加權</div><div className="text-[10px] opacity-70">數值 × 倍率</div></div></button>
                <button onClick={() => setCalculationMode('sum-parts')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'sum-parts' ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(2,132,199,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><PlusSquare size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">分項累加</div><div className="text-[10px] opacity-70">1+2+3...</div></div></button>
                <button onClick={() => setCalculationMode('product')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'product' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><BoxSelect size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">乘積輸入</div><div className="text-[10px] opacity-70"> A × B</div></div></button>
            </div>
        </div>

        {/* Dynamic Inputs based on Mode */}
        {currentCalcMode === 'product' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">乘積單位</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1"> A 的單位</label>
                            <input type="text" value={column.subUnits?.[0] || ''} onChange={e => onChange({ subUnits: [e.target.value, column.subUnits?.[1] || ''] })} onFocus={e => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"/>
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1"> B 的單位</label>
                            <input type="text" value={column.subUnits?.[1] || ''} onChange={e => onChange({ subUnits: [column.subUnits?.[0] || '', e.target.value] })} onFocus={e => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-center focus:border-indigo-500 outline-none"/>
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
            <div className={`space-y-4 animate-in fade-in slide-in-from-top-2 p-4 rounded-xl border ${currentCalcMode === 'sum-parts' ? 'bg-sky-900/10 border-sky-500/20' : 'bg-emerald-900/10 border-emerald-500/20'}`}>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label>
                    <input type="text" value={column.unit || ''} onChange={e => onChange({ unit: e.target.value })} onFocus={e => e.target.select()} placeholder="如：分、個、元" className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"/>
                </div>
                {currentCalcMode !== 'sum-parts' && (
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-3">
                        <span className="text-slate-400 text-sm">輸入值</span>
                        <span className="text-slate-600">×</span>
                        <input 
                            type="text" 
                            inputMode="decimal" 
                            value={column.constants?.c1 ?? 1} 
                            onChange={e => { 
                                const val = e.target.value; 
                                if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) { 
                                    onChange({ constants: { ...column.constants, c1: val as any }}); 
                                } else { 
                                    const num = parseFloat(val); 
                                    if (!isNaN(num)) onChange({ constants: { ...column.constants, c1: num }}); 
                                } 
                            }} 
                            onFocus={e => e.target.select()} 
                            className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded outline-none focus:border-emerald-500"
                        />
                        <span className="text-slate-600">=</span>
                        <span className="text-white font-bold">得分</span>
                    </div>
                )}
            </div>
        )}

        {/* Sum Parts Specifics */}
        {currentCalcMode === 'sum-parts' && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">格內顯示方式</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                        <button onClick={() => onChange({ showPartsInGrid: true })} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${(column.showPartsInGrid ?? true) === true ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><Eye size={14} /> 顯示各項</button>
                        <button onClick={() => onChange({ showPartsInGrid: false })} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${(column.showPartsInGrid ?? true) === false ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><EyeOff size={14} /> 僅顯示總和</button>
                    </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入方式</label>
                        <ToggleSwitch 
                            checked={column.inputType === 'clicker'} 
                            onChange={() => onChange({ inputType: column.inputType === 'clicker' ? 'keypad' : 'clicker' })} 
                            label="啟用按鈕輸入面板" 
                        />
                        <p className="text-[10px] text-slate-500 px-1">
                            {column.inputType === 'clicker' 
                                ? '目前模式：顯示自訂按鈕，適合固定數值累加。' 
                                : '目前模式：使用數字鍵盤，適合輸入任意數值。'}
                        </p>
                    </div>

                    {column.inputType === 'clicker' && (
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <QuickActionsEditor
                                quickActions={column.quickActions || []}
                                buttonGridColumns={column.buttonGridColumns}
                                defaultColor={column.color}
                                showModifierToggle={true}
                                onChange={onChange}
                            />
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Rounding Options */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
            <ToggleSwitch checked={isRoundingEnabled} onChange={toggleRounding} label="啟用小數點進位/捨去"/>
            {isRoundingEnabled && (
                <div className="animate-in fade-in slide-in-from-top-2 pt-2 pl-2 border-l-2 border-slate-700 ml-4">
                    <div className="grid grid-cols-3 gap-2">
                        {(['floor', 'ceil', 'round'] as const).map(mode => (
                            <button key={mode} onClick={() => onChange({ rounding: mode })} className={`py-2 px-1 rounded-lg border text-xs font-bold ${column.rounding === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                {mode === 'floor' ? '無條件捨去' : mode === 'ceil' ? '無條件進位' : '四捨五入'}
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

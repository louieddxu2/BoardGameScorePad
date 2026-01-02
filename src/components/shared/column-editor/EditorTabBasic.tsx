
import React, { useEffect } from 'react';
import { ScoreColumn, InputMethod } from '../../../types';
import { Calculator, BoxSelect, Hash, Plus, X as Multiply } from 'lucide-react';
import QuickActionsEditor from './QuickActionsEditor';

interface EditorTabBasicProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
  cachedSumPartsInputType: InputMethod;
  onUpdateCachedSumPartsInputType: (type: InputMethod) => void;
}

type CalculationMode = 'standard' | 'product';

// Extracted Sub-Settings Component for reusability
const SumPartsSubSettings: React.FC<{ 
    column: ScoreColumn, 
    onChange: (updates: Partial<ScoreColumn>) => void,
    themeColor?: 'emerald' | 'indigo',
    isProductMode?: boolean
}> = ({ column, onChange, themeColor = 'emerald', isProductMode = false }) => {
    const activeSwitchClass = themeColor === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
    
    // Normalize logic for undefined (default is true)
    const currentMode = column.showPartsInGrid === undefined ? true : column.showPartsInGrid;

    return (
        <>
            <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">格內顯示方式</label>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button onClick={() => onChange({ showPartsInGrid: true })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === true ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                        標準
                    </button>
                    <button onClick={() => onChange({ showPartsInGrid: false })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === false ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                        僅顯示總和
                    </button>
                    <button onClick={() => onChange({ showPartsInGrid: 'parts_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentMode === 'parts_only' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                        僅顯示分項
                    </button>
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">輸入方式</label>
                <div className={`flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors`} onClick={() => onChange({ inputType: column.inputType === 'clicker' ? 'keypad' : 'clicker' })}>
                    <span className="text-sm font-bold text-slate-300">使用按鈕輸入面板</span>
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${column.inputType === 'clicker' ? activeSwitchClass : 'bg-slate-600'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${column.inputType === 'clicker' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </div>
                {column.inputType === 'clicker' && (
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4 mt-2">
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

const EditorTabBasic: React.FC<EditorTabBasicProps> = ({ column, onChange, cachedSumPartsInputType, onUpdateCachedSumPartsInputType }) => {
  
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
          onUpdateCachedSumPartsInputType(column.inputType || 'keypad');
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
            updates.subUnits = ['分', '個'];
        }
        
        // CRITICAL: Do NOT reset inputType if Sum Parts is enabled. 
        // If Sum Parts is disabled, Product mode defaults to Keypad.
        if (willEnableSumParts) {
            updates.inputType = column.inputType || cachedSumPartsInputType;
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
              onChange({ constants: { ...column.constants, c1: val as any }});
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

  const isRoundingEnabled = column.rounding && column.rounding !== 'none';
  
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

  // Enhanced Toggle Switch
  const ToggleSwitch = ({ checked, onChange, label, themeColor = 'emerald' }: { checked: boolean, onChange: () => void, label: string, themeColor?: 'emerald' | 'indigo' }) => {
    const activeClass = themeColor === 'emerald' ? 'bg-emerald-900/30 border-emerald-500' : 'bg-indigo-900/30 border-indigo-500';
    const activeTextClass = themeColor === 'emerald' ? 'text-emerald-100' : 'text-indigo-100';
    const activeKnobClass = themeColor === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';

    return (
        <div 
            onClick={onChange} 
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-300 ${checked ? activeClass : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}
        >
            <span className={`text-sm font-bold transition-colors ${checked ? activeTextClass : 'text-slate-300'}`}>{label}</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? activeKnobClass : 'bg-slate-600'}`}>
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Mode Switcher */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">計分模式</label>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setCalculationMode('standard')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'standard' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><Calculator size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">標準加權</div><div className="text-[10px] opacity-70">單位 × 常數</div></div></button>
                <button onClick={() => setCalculationMode('product')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${currentCalcMode === 'product' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}><BoxSelect size={24} /><div className="leading-tight text-center"><div className="text-xs font-bold uppercase">乘積運算</div><div className="text-[10px] opacity-70"> A × B</div></div></button>
            </div>
        </div>

        {/* Base Config Block - Content Depends on Mode */}
        {currentCalcMode === 'standard' && (
            <div className="p-4 rounded-xl border bg-emerald-900/10 border-emerald-500/20 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label>
                    <input type="text" value={column.unit || ''} onChange={e => onChange({ unit: e.target.value })} onFocus={e => e.target.select()} placeholder="如：分、個、元" className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none"/>
                </div>
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-center gap-3">
                    <span className="text-slate-400 text-sm">輸入值</span>
                    <span className="text-slate-600">×</span>
                    {/* SWAPPED ORDER */}
                    <input 
                        type="text" 
                        inputMode="decimal" 
                        value={column.constants?.c1 ?? 1} 
                        onChange={e => updateMultiplier(e.target.value)} 
                        onFocus={e => e.target.select()} 
                        className="w-20 bg-slate-800 border border-emerald-500/50 text-emerald-400 text-center font-bold p-2 rounded outline-none focus:border-emerald-500"
                    />
                    {isSumPartsEnabled ? (
                        <>
                            <span className="text-slate-600 font-bold px-1"><Plus size={14} /></span>
                            <span className="text-slate-400 text-sm">...</span>
                        </>
                    ) : null}
                    <span className="text-slate-600">=</span>
                    <span className="text-white font-bold">得分</span>
                </div>
            </div>
        )}

        {currentCalcMode === 'product' && (
            <div className="p-4 rounded-xl border bg-indigo-900/10 border-indigo-500/20 space-y-4">
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
                    <span className="text-emerald-500 font-bold"><Multiply size={10} /></span>
                    <span className="text-slate-400 text-sm">B</span>
                    {isSumPartsEnabled && (
                        <>
                            <span className="text-slate-600 font-bold px-1"><Plus size={14} /></span>
                            <span className="text-slate-400 text-sm">...</span>
                        </>
                    )}
                    <span className="text-slate-600">=</span>
                    <span className="text-white font-bold">得分</span>
                </div>
            </div>
        )}

        {/* Sum Parts Toggle & Settings - Shared & Synchronized */}
        <div>
            <ToggleSwitch 
                checked={isSumPartsEnabled} 
                onChange={toggleSumParts} 
                label="啟用分項累加" 
                themeColor={currentCalcMode === 'product' ? 'indigo' : 'emerald'}
            />

            {isSumPartsEnabled && (
                <div className={`pt-4 pl-4 ml-4 border-l-2 space-y-4 animate-in fade-in slide-in-from-top-2 ${currentCalcMode === 'product' ? 'border-indigo-500' : 'border-emerald-500'}`}>
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
        <div className="space-y-2 pt-4 border-t border-slate-800">
            <ToggleSwitch 
                checked={isRoundingEnabled} 
                onChange={toggleRounding} 
                label="啟用小數點進位/捨去" 
                themeColor="indigo"
            />
            {isRoundingEnabled && (
                <div className="animate-in fade-in slide-in-from-top-2 pt-4 pl-4 border-l-2 border-indigo-500 ml-4">
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

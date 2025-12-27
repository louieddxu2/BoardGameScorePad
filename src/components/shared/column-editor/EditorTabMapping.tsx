
import React from 'react';
import { ScoreColumn, MappingRule } from '../../../types';
import { Infinity as InfinityIcon, ArrowRight as ArrowRightIcon, Lock, TrendingUp, Trash2, Plus } from 'lucide-react';

interface EditorTabMappingProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
}

const EditorTabMapping: React.FC<EditorTabMappingProps> = ({ column, onChange }) => {
  const rules = column.f1 || [];

  const getMinConstraint = (idx: number, currentRules: MappingRule[]): number => {
    if (idx === 0) return -999999;
    const prevRule = currentRules[idx - 1];
    let prevEnd = (prevRule.max === 'next') ? (prevRule.min ?? 0) : (prevRule.max ?? prevRule.min ?? 0);
    return prevEnd + 1;
  };

  const updateMappingRule = (idx: number, field: keyof MappingRule, val: any) => {
    const newRules = [...rules];
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
    onChange({ f1: newRules });
  };

  const addMappingRule = () => {
    const newRules = [...rules];
    let newMin = 0;
    let lastScore = 0;
    if (newRules.length > 0) {
      const lastRule = newRules[newRules.length - 1];
      lastScore = lastRule.score;
      newMin = (typeof lastRule.max === 'number' ? lastRule.max : lastRule.min ?? -1) + 1;
      newRules[newRules.length - 1] = { ...lastRule, max: 'next' };
    }
    onChange({ f1: [...newRules, { min: newMin, max: undefined, score: lastScore, isLinear: false }] });
  };

  const removeMappingRule = (idx: number) => {
    let newRules = rules.filter((_, i) => i !== idx);
    if (idx > 0 && idx === rules.length - 1 && newRules[newRules.length - 1]?.max === 'next') {
      newRules[newRules.length - 1].max = undefined;
    }
    if (idx === 0 && newRules.length > 0) newRules[0].isLinear = false;
    onChange({ f1: newRules });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
        <p className="text-sm text-slate-400">設定數值區間與對應分數，或是在區間內每a加b。</p>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">單位</label>
          <input
            type="text"
            value={column.unit || ''}
            onChange={e => onChange({ unit: e.target.value })}
            onFocus={e => e.target.select()}
            placeholder="如：分、個、元"
            className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 outline-none"
          />
        </div>
      </div>
      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 relative">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="最小"
                value={rule.min ?? ''}
                onChange={e => {
                  const val = e.target.value;
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
              <div className="relative w-14">
                {rule.max === 'next' ? (
                  <div className="w-full h-full bg-slate-800 border border-slate-700/50 rounded p-2 text-center flex items-center justify-center text-indigo-400 text-xs font-bold">NEXT</div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="最大"
                    value={rule.max ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        updateMappingRule(idx, 'max', undefined);
                      } else if (val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
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
                    <ArrowRightIcon size={12} className={`transition-all ${!rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} />
                    <TrendingUp size={12} className={`transition-all ${rule.isLinear ? 'text-emerald-400 opacity-100 scale-110' : 'text-slate-600 opacity-50'}`} />
                  </>
                )}
              </button>
              <div className="flex-1 min-w-0">
                {rule.isLinear ? (
                  <div className="grid grid-cols-2 gap-1 h-[38px]">
                    <div className="relative bg-slate-900 border border-slate-600 rounded-md flex items-center overflow-hidden">
                      <span className="absolute left-2 text-[10px] text-slate-500 font-bold z-10 pointer-events-none">每</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rule.unit ?? 1}
                        onChange={e => {
                          const val = e.target.value;
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
                    <div className="relative bg-slate-900 border border-emerald-500/30 rounded-md flex items-center overflow-hidden">
                      <span className="absolute left-2 text-[10px] text-emerald-500 font-bold z-10 pointer-events-none">加</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rule.unitScore !== undefined ? rule.unitScore : rule.score}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || val === '-' || val.endsWith('.') || (val.includes('.') && val.endsWith('0'))) {
                            updateMappingRule(idx, 'unitScore', val as any);
                          } else {
                            const num = parseFloat(val);
                            if (!isNaN(num)) updateMappingRule(idx, 'unitScore', num);
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
              <button onClick={() => removeMappingRule(idx)} className="p-2 text-slate-500 hover:text-red-400">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={addMappingRule}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2"
      >
        <Plus size={18} /> 新增區間
      </button>
    </div>
  );
};

export default EditorTabMapping;

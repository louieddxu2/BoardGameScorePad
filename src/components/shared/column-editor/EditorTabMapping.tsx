
import React, { useEffect } from 'react';
import { ScoreColumn, MappingRule } from '../../../types';
import { ArrowRight as ArrowRightIcon, Lock, TrendingUp, Trash2, Plus } from 'lucide-react';
import { useColumnEditorTranslation } from '../../../i18n/column_editor'; // Changed Import

interface EditorTabMappingProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
  hideUnitInput?: boolean;
}

const PREF_KEY_STD_UNIT = 'sm_pref_standard_unit';

const EditorTabMapping: React.FC<EditorTabMappingProps> = ({ column, onChange, hideUnitInput }) => {
  const { t } = useColumnEditorTranslation(); // Use New Hook
  const rules = column.f1 || [];

  // Load last unit if this is a standalone column mapping (not inside auto) and unit is empty
  useEffect(() => {
      if (!hideUnitInput && !column.unit) {
          const lastUnit = localStorage.getItem(PREF_KEY_STD_UNIT);
          if (lastUnit) onChange({ unit: lastUnit });
      }
  }, [hideUnitInput]);

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
      // 移除輸入時的強制驗證，改在 onBlur 處理
      updatedRule = { ...updatedRule, [field]: val };
    }
    newRules[idx] = updatedRule;
    onChange({ f1: newRules });
  };

  const handleBlur = (idx: number, field: keyof MappingRule) => {
    const newRules = [...rules];
    let updatedRule = { ...newRules[idx] };
    
    // 嘗試解析數值 (處理輸入過程中的字串狀態)
    const rawVal = updatedRule[field];
    let val: number | undefined = undefined;
    
    if (typeof rawVal === 'string') {
        // 如果是空字串，視為 undefined
        if (rawVal.trim() === '') val = undefined;
        else {
            const parsed = parseFloat(rawVal);
            val = isNaN(parsed) ? undefined : parsed;
        }
    } else if (typeof rawVal === 'number') {
        val = rawVal;
    }

    if (field === 'min') {
        // min 必須有值，若無則預設為約束值
        const constraint = getMinConstraint(idx, newRules);
        const finalVal = val !== undefined ? val : constraint;
        updatedRule.min = Math.max(finalVal, constraint);
    } else if (field === 'max') {
        // max 可以是 undefined (無限大)
        if (val !== undefined) {
            const minVal = (typeof updatedRule.min === 'number') ? updatedRule.min : -Infinity;
            updatedRule.max = Math.max(val, minVal);
        } else {
            updatedRule.max = undefined;
        }
    } else if (field === 'unit') {
        // unit 至少為 1
        if (val !== undefined) {
            updatedRule.unit = Math.max(1, val);
        } else {
            updatedRule.unit = 1;
        }
    } else {
        // 其他欄位 (score, unitScore) 僅做型別正規化
        if (val !== undefined) {
            (updatedRule as any)[field] = val;
        }
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
      <div className="bg-modal-bg-recessed p-4 rounded-xl border border-surface-border/50 space-y-4">
        <p className="text-sm text-txt-secondary">{t('col_mapping_desc')}</p>
        {!hideUnitInput && (
            <div>
            <label className="block text-xs font-bold text-txt-muted uppercase mb-1">{t('col_unit')}</label>
            <input
                type="text"
                value={column.unit || ''}
                onChange={e => {
                    onChange({ unit: e.target.value });
                }}
                onFocus={e => e.target.select()}
                placeholder={t('col_unit')}
                className="w-full bg-modal-bg border border-surface-border rounded-xl p-3 text-txt-primary font-bold focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all"
            />
            </div>
        )}
      </div>
      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex flex-col gap-2 bg-modal-bg-elevated p-2 rounded-xl border border-surface-border shadow-sm relative">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder={t('col_mapping_min')}
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
                onBlur={() => handleBlur(idx, 'min')}
                onFocus={e => e.target.select()}
                className="w-14 bg-modal-bg border border-surface-border rounded-lg p-2 text-center text-txt-primary text-sm font-black outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all"
              />
              <span className="text-txt-muted">~</span>
              <div className="relative w-14">
                {rule.max === 'next' ? (
                  <div className="w-full h-full bg-modal-bg-recessed border border-surface-border/50 rounded-lg p-2 text-center flex items-center justify-center text-brand-secondary text-[10px] font-black uppercase">{t('col_mapping_next')}</div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={t('col_mapping_max')}
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
                    onBlur={() => handleBlur(idx, 'max')}
                    onFocus={e => e.target.select()}
                    className="w-full bg-modal-bg border border-surface-border rounded-lg p-2 text-center text-txt-primary placeholder:text-txt-muted/50 text-sm font-black outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all"
                  />
                )}
                {rule.max === undefined && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-txt-muted text-lg leading-none pb-1 font-bold">
                    ∞
                  </div>
                )}
              </div>
              <button
                onClick={() => idx !== 0 && updateMappingRule(idx, 'isLinear', !rule.isLinear)}
                disabled={idx === 0}
                className={`w-8 h-[38px] flex flex-col items-center justify-center gap-0.5 rounded-lg shrink-0 transition-all active:scale-95 ${idx === 0 ? 'bg-modal-bg-recessed border border-dashed border-surface-border text-txt-muted opacity-50' : 'bg-modal-bg border border-surface-border text-txt-secondary hover:text-txt-primary shadow-sm'}`}
                title={idx === 0 ? t('col_mapping_lock_hint') : (rule.isLinear ? t('col_mapping_mode_linear') : t('col_mapping_mode_fixed'))}
              >
                {idx === 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <ArrowRightIcon size={12} className="text-brand-primary" />
                    <Lock size={10} className="text-txt-muted" />
                  </div>
                ) : (
                  <>
                    <ArrowRightIcon size={12} className={`transition-all ${!rule.isLinear ? 'text-brand-primary opacity-100 scale-110' : 'text-txt-muted opacity-50'}`} />
                    <TrendingUp size={12} className={`transition-all ${rule.isLinear ? 'text-brand-primary opacity-100 scale-110' : 'text-txt-muted opacity-50'}`} />
                  </>
                )}
              </button>
              <div className="flex-1 min-w-0">
                {rule.isLinear ? (
                  <div className="grid grid-cols-2 gap-1 h-[38px]">
                    <div className="relative bg-modal-bg border border-surface-border rounded-lg flex items-center overflow-hidden focus-within:ring-4 focus-within:ring-brand-primary/10 transition-all shadow-sm">
                      <span className="absolute left-2 text-[8px] text-txt-muted font-black z-10 pointer-events-none uppercase">{t('col_mapping_per')}</span>
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
                        onBlur={() => handleBlur(idx, 'unit')}
                        onFocus={e => e.target.select()}
                        className="w-full h-full bg-transparent text-txt-primary text-center text-sm pl-4 pr-1 outline-none font-black"
                      />
                    </div>
                    <div className="relative bg-modal-bg border-2 border-brand-primary/30 rounded-lg flex items-center overflow-hidden focus-within:ring-4 focus-within:ring-brand-primary/10 transition-all shadow-sm">
                      <span className="absolute left-2 text-[8px] text-brand-primary font-black z-10 pointer-events-none uppercase">{t('col_mapping_add')}</span>
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
                        onBlur={() => handleBlur(idx, 'unitScore')}
                        onFocus={e => e.target.select()}
                        className="w-full h-full bg-transparent text-brand-primary font-black text-center text-sm pl-4 pr-1 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-[38px]">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={t('col_mapping_val')}
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
                      onBlur={() => handleBlur(idx, 'score')}
                      onFocus={e => e.target.select()}
                      className="w-full h-full bg-modal-bg border-2 border-brand-primary/40 text-brand-primary font-black rounded-lg p-2 text-center text-sm outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all shadow-sm"
                    />
                  </div>
                )}
              </div>
              <button onClick={() => removeMappingRule(idx)} className="p-2 text-txt-muted hover:text-status-danger transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={addMappingRule}
        className="w-full py-3 bg-modal-bg-recessed hover:bg-modal-bg hover:text-brand-primary text-txt-secondary rounded-xl border border-dashed border-surface-border flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98]"
      >
        <Plus size={18} /> {t('col_add_interval')}
      </button>
    </div>
  );
};

export default EditorTabMapping;

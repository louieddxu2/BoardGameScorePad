
import React from 'react';
import { ScoreColumn } from '../types';
import { getRawValue } from './scoring';

// --- 1. Basic Formatting ---

export const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Number.isNaN(num)) return 'NaN';
  if (num === Infinity) return '∞';
  if (num === -Infinity) return '-∞';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

// --- 2. Input Resolution (Active Editing State) ---

/**
 * 取得單一數值的顯示字串。
 * 若處於編輯狀態 (isActive) 且有暫存輸入 (previewValue)，則回傳原始輸入字串 (保留 "5." 或 "-0")。
 * 否則回傳 undefined (讓 UI 使用儲存的數值)。
 */
export const getRawInputString = (previewValue: any, isActive: boolean): string | undefined => {
    if (!isActive || previewValue === undefined) return undefined;

    if (typeof previewValue === 'object' && 'value' in previewValue) {
         const val = previewValue.value;
         if (typeof val === 'string') return val;
         if (Object.is(val, -0)) return "-0";
         return String(val);
    } 
    
    if (typeof previewValue === 'string') {
         return previewValue;
    } 
    
    if (typeof previewValue === 'number') {
         if (Object.is(previewValue, -0)) return "-0";
         return String(previewValue);
    }

    return undefined;
};

/**
 * 取得乘積模式 (Product) 的兩個因子顯示字串。
 * 若處於編輯狀態，優先使用暫存輸入中的原始字串。
 * 回傳 [DisplayA, DisplayB]
 */
export const getProductInputStrings = (
    previewValue: any, 
    isActive: boolean, 
    savedParts: number[]
): [string, string] => {
    // 1. Default from saved data
    let displayA = formatDisplayNumber(savedParts[0] ?? 0);
    let displayB = formatDisplayNumber(savedParts[1] ?? 1);

    // 2. Override if active editing
    if (isActive && previewValue && typeof previewValue === 'object' && Array.isArray(previewValue.factors)) {
         const rawA = previewValue.factors[0];
         const rawB = previewValue.factors[1];
         
         const formatFactor = (v: any) => {
             if (typeof v === 'string') return v;
             return formatDisplayNumber(v);
         };

         displayA = formatFactor(rawA);
         displayB = formatFactor(rawB);
    }
    
    return [displayA, displayB];
};

// --- 3. Ghost Preview (Sum Parts Logic) ---

/**
 * 取得分項累加 (Sum Parts) 的幽靈預覽資訊。
 * 包含計算後的數值 (用於判斷是否顯示) 與渲染用的 React Node (包含單位、乘號等)。
 */
export const getGhostPreview = (previewValue: any, column: ScoreColumn): { val: number | null, labelNode: React.ReactNode | null } => {
    if (!previewValue) return { val: null, labelNode: null };
    
    // Scenario A: Product Sum Parts (A * B)
    if (column.formula.includes('×a2')) {
        if (typeof previewValue === 'object' && previewValue.factors) {
            const f1Raw = previewValue.factors[0];
            const f2Raw = previewValue.factors[1];
            
            const f1 = parseFloat(String(f1Raw)) || 0;
            // Parse f2 correctly, default to 0 if NaN (InputPanel inits to 1 usually, but ghost implies change)
            const f2Num = parseFloat(String(f2Raw));
            const f2 = isNaN(f2Num) ? 0 : f2Num;

            // Display Strings (Preserve raw if string)
            const d1 = typeof f1Raw === 'string' ? f1Raw : formatDisplayNumber(f1);
            const d2 = typeof f2Raw === 'string' ? f2Raw : formatDisplayNumber(f2);
            
            // Show preview if input is meaningful (not just default 0, 1)
            const isDefault = d1 === '0' && d2 === '1';
            
            if (!isDefault) {
                 const product = f1 * f2;
                 const ua = column.subUnits?.[0] || '';
                 const ub = column.subUnits?.[1] || '';
                 
                 const labelNode = (
                    <span className="inline-flex items-baseline justify-end gap-[2px] whitespace-nowrap">
                        <span>{d1}</span>
                        <span className="text-[10px] opacity-80">{ua}</span>
                        <span className="mx-0.5 text-xs opacity-70">×</span>
                        <span>{d2}</span>
                        <span className="text-[10px] opacity-80">{ub}</span>
                    </span>
                 );

                 return { val: product, labelNode };
            }
        }
        return { val: null, labelNode: null };
    }
    
    // Scenario B: Standard Sum Parts
    let displayStr = "";
    let rawVal = 0;

    if (typeof previewValue === 'object' && 'value' in previewValue) {
         const val = previewValue.value;
         rawVal = parseFloat(String(val)) || 0;
         if (typeof val === 'string') displayStr = val;
         else if (Object.is(val, -0)) displayStr = "-0";
         else displayStr = String(val);
    } else {
         rawVal = getRawValue(previewValue);
         displayStr = formatDisplayNumber(rawVal);
    }
    
    // Show preview if input is not "0" (default/empty) or empty string
    // "-0" counts as valid input to show
    if (displayStr !== "0" && displayStr !== "") {
        const constant = column.constants?.c1 ?? 1;
        let finalLabel = displayStr;
        let finalVal = rawVal;
        
        // If there is a multiplier, show the RESULT
        if (constant !== 1) {
            finalVal = rawVal * constant;
            finalLabel = formatDisplayNumber(finalVal);
        } else {
            // No multiplier: use the raw display string (preserves "5.")
            finalVal = rawVal;
        }
        
        const labelNode = (
            <span className="inline-flex items-baseline justify-end whitespace-nowrap">
                {finalLabel}
                {column.unit && <span className="text-[10px] ml-0.5 not-italic opacity-80">{column.unit}</span>}
            </span>
        );
        
        return { val: finalVal, labelNode };
    }
    
    return { val: null, labelNode: null };
};


import React, { useState, useEffect } from 'react';
import { GameTemplate, ScoreColumn } from '../../types';
import { Save, ArrowLeft, Layers, Minus, Plus } from 'lucide-react';
import { COLORS } from '../../constants';

interface TemplateEditorProps {
  onSave: (template: GameTemplate) => void;
  onCancel: () => void;
  initialTemplate?: GameTemplate; // Support editing
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ onSave, onCancel, initialTemplate }) => {
  const [name, setName] = useState('');
  const [columnCount, setColumnCount] = useState(5);

  useEffect(() => {
      if (initialTemplate) {
          setName(initialTemplate.name);
          setColumnCount(initialTemplate.columns.length);
      }
  }, [initialTemplate]);

  const adjustCount = (delta: number) => {
    setColumnCount(prev => Math.max(1, Math.min(20, prev + delta)));
  };

  const handleSave = () => {
    if (!name.trim()) return alert('請輸入遊戲名稱');

    let newColumns: ScoreColumn[] = [];

    if (initialTemplate) {
        const existing = initialTemplate.columns;
        if (columnCount <= existing.length) {
            newColumns = existing.slice(0, columnCount);
        } else {
            const addedCount = columnCount - existing.length;
            const added = Array.from({ length: addedCount }).map((_, i) => ({
                id: crypto.randomUUID(),
                name: `項目 ${existing.length + i + 1}`,
                type: 'number' as const,
                isScoring: true,
                weight: 1,
                options: [],
                mappingRules: [],
                unit: '',
                rounding: 'none' as const,
                quickButtons: []
            }));
            newColumns = [...existing, ...added];
        }
    } else {
        newColumns = Array.from({ length: columnCount }).map((_, i) => ({
            id: crypto.randomUUID(),
            name: `項目 ${i + 1}`,
            type: 'number',
            isScoring: true,
            weight: 1,
            options: [],
            mappingRules: [],
            unit: '',
            rounding: 'none',
            quickButtons: [],
            color: COLORS[i % COLORS.length]
        }));
    }

    const template: GameTemplate = {
      id: initialTemplate ? initialTemplate.id : crypto.randomUUID(),
      name: name.trim(),
      description: initialTemplate?.description || `${columnCount} 個計分項目`,
      columns: newColumns,
      createdAt: initialTemplate ? initialTemplate.createdAt : Date.now(),
    };

    onSave(template);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 relative overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-slate-800 p-4 shadow-md flex items-center justify-between border-b border-slate-700">
        <button onClick={onCancel} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold">{initialTemplate ? '編輯模板' : '建立新遊戲'}</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center p-6 space-y-8 min-h-full">
            
            <div className="w-full max-w-md space-y-6">
            
            {/* Common Input: Name */}
            <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider">
                遊戲名稱
                </label>
                <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="例如：卡坦島、璀璨寶石..."
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-xl font-bold text-white focus:border-emerald-500 focus:outline-none placeholder-slate-600 transition-colors"
                autoFocus
                />
            </div>

            {/* Manual Mode Content */}
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    計分項目數量 <span className="text-xs font-normal text-slate-500">(不含總分)</span>
                    </label>
                    
                    <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <button 
                            onClick={() => adjustCount(-1)}
                            className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center text-white border border-slate-600"
                        >
                            <Minus size={24} />
                        </button>
                        
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black font-mono text-emerald-400">{columnCount}</span>
                            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Layers size={12} /> 列
                            </span>
                        </div>

                        <button 
                            onClick={() => adjustCount(1)}
                            className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center text-white border border-slate-600"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleSave}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Save size={24} /> {initialTemplate ? '儲存變更' : '建立模板'}
                </button>
                <p className="text-center text-xs text-slate-500">
                    提示：建立後，您可以在計分表中點擊標題來修改名稱或設定規則。
                </p>
            </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;

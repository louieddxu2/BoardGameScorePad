
import React, { useState } from 'react';
import { GameTemplate } from '../../types';
import { Search, X } from 'lucide-react';

interface ImportTemplateModalProps {
  allTemplates: GameTemplate[];
  onSelect: (t: GameTemplate) => void;
  onClose: () => void;
}

const ImportTemplateModal: React.FC<ImportTemplateModalProps> = ({ allTemplates, onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const filtered = allTemplates.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));
    
    return (
        <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex flex-col p-4">
            <div className="bg-slate-900 w-full max-w-md mx-auto rounded-2xl shadow-2xl border border-slate-700 flex flex-col h-full max-h-[90vh]">
                <div className="p-4 border-b border-slate-800 shrink-0">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                            type="text" 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            placeholder="搜尋現有模板..." 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-emerald-500 outline-none" 
                            autoFocus 
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                    {filtered.map(t => (
                        <button key={t.id} onClick={() => onSelect(t)} className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors">
                            <h4 className="font-bold text-white">{t.name}</h4>
                            <p className="text-xs text-slate-400">
                                {/* Use injected property if available, fallback to length if full object */}
                                {(t as any).columnCount ?? t.columns.length}個項目
                            </p>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-slate-800 shrink-0">
                    <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold">取消</button>
                </div>
            </div>
        </div>
    );
};

export default ImportTemplateModal;

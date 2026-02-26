import React, { useState } from 'react';
import { GameTemplate } from '../../types';
import { Search } from 'lucide-react';
import { useTemplateEditorTranslation } from '../../i18n/template_editor';

interface ImportTemplateModalProps {
    allTemplates: GameTemplate[];
    onSelect: (t: GameTemplate) => void;
    onClose: () => void;
}

const ImportTemplateModal: React.FC<ImportTemplateModalProps> = ({ allTemplates, onSelect, onClose }) => {
    const { t } = useTemplateEditorTranslation();
    const [query, setQuery] = useState('');
    const filtered = allTemplates.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <div
            className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex flex-col p-4"
            onClick={(e) => {
                // Allow clicking backdrop to close
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-slate-900 w-full max-w-md mx-auto rounded-2xl shadow-2xl border border-slate-700 flex flex-col h-full max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-800 shrink-0">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('mapper_search_placeholder')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-emerald-500 outline-none"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                    {filtered.map(t_item => (
                        <button key={t_item.id} onClick={() => onSelect(t_item)} className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors">
                            <h4 className="font-bold text-white">{t_item.name}</h4>
                            <p className="text-xs text-slate-400">
                                {/* Use injected property if available, fallback to length if full object */}
                                {t('mapper_col_unit_alt', { count: (t_item as any).columnCount ?? t_item.columns.length })}
                            </p>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-slate-800 shrink-0">
                    <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold">{t('tmpl_btn_std').includes('Standard') ? 'Cancel' : '取消' /* Fallback if common cancel not available */}</button>
                </div>
            </div>
        </div>
    );
};

export default ImportTemplateModal;

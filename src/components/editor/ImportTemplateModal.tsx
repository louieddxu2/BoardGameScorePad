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
            className="modal-backdrop z-[90]"
            onClick={(e) => {
                // Allow clicking backdrop to close
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-modal-bg w-full max-w-md mx-auto rounded-2xl shadow-2xl border border-modal-border flex flex-col h-full max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-modal-border shrink-0">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('mapper_search_placeholder')}
                            className="w-full bg-modal-bg-elevated border border-modal-border rounded-lg pl-10 pr-4 py-2 text-txt-primary focus:border-brand-primary outline-none"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                    {filtered.map(t_item => (
                        <button key={t_item.id} onClick={() => onSelect(t_item)} className="w-full text-left p-3 rounded-lg hover:bg-modal-bg-elevated transition-colors">
                            <h4 className="font-bold text-txt-primary">{t_item.name}</h4>
                            <p className="text-xs text-txt-muted">
                                {/* Use injected property if available, fallback to length if full object */}
                                {t('mapper_col_unit_alt', { count: (t_item as any).columnCount ?? t_item.columns.length })}
                            </p>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-modal-border shrink-0">
                    <button onClick={onClose} className="w-full py-2 bg-surface-bg hover:bg-surface-hover rounded-lg text-txt-primary font-bold">{t('tmpl_btn_std').includes('Standard') ? 'Cancel' : '取消' /* Fallback if common cancel not available */}</button>
                </div>
            </div>
        </div>
    );
};

export default ImportTemplateModal;


import React from 'react';
import { Plus, Search } from 'lucide-react';
import { useTranslation } from '../../../i18n';

interface SearchEmptyStateProps {
  searchQuery: string;
  onCreate: (name?: string) => void;
}

const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ searchQuery, onCreate }) => {
  const { t } = useTranslation();

  if (!searchQuery) {
    return (
      <div className="col-span-2 flex flex-col items-center justify-center py-12 text-slate-500 gap-3 border-2 border-dashed border-slate-800 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
            <Search size={20} className="opacity-50" />
        </div>
        <span className="text-sm italic">{t('dash_no_templates')}</span>
      </div>
    );
  }

  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-8 gap-4 border-2 border-dashed border-slate-800 rounded-xl animate-in fade-in zoom-in-95 duration-300">
      <p className="text-slate-500 text-sm italic">
        {t('dash_no_search_results')}
      </p>
      
      <button 
        onClick={() => onCreate(searchQuery)}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-900/50 hover:border-emerald-500/50 transition-all active:scale-95 shadow-sm group"
      >
        <div className="bg-emerald-500/20 p-1 rounded-md group-hover:bg-emerald-500/30 transition-colors">
            <Plus size={16} strokeWidth={3} />
        </div>
        <span className="font-bold text-sm">
            建立 "{searchQuery}"
        </span>
      </button>
    </div>
  );
};

export default SearchEmptyState;

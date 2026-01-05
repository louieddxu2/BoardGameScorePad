
import React from 'react';
import { HistoryRecord } from '../../types';
import HistoryCard from './parts/HistoryCard';
import { History as HistoryIcon } from 'lucide-react';

interface HistoryListProps {
  records: HistoryRecord[] | undefined;
  onDelete: (id: number) => void;
  onSelect: (record: HistoryRecord) => void; 
}

const HistoryList: React.FC<HistoryListProps> = ({ records, onDelete, onSelect }) => {
  // Logic updated: records passed here are already filtered by the DB hook based on search query.
  // We render whatever we get.

  if (!records || records.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700">
                  <HistoryIcon size={40} className="opacity-50" />
              </div>
              <p className="text-sm font-bold">沒有紀錄</p>
              <p className="text-xs max-w-[200px] text-center opacity-70">如果是搜尋結果為空，請嘗試其他關鍵字。</p>
          </div>
      );
  }

  return (
    <div className="space-y-3 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {records.map(record => (
            <HistoryCard 
                key={record.id} 
                record={record} 
                onDelete={onDelete}
                onClick={() => onSelect(record)}
            />
        ))}
    </div>
  );
};

export default HistoryList;

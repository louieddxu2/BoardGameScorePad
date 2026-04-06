
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  titleColorClass?: string; // e.g. "text-white"
  iconColorClass?: string; // e.g. "text-emerald-400"
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean; // For new badge logic
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  titleColorClass = "text-slate-50",
  iconColorClass = "text-slate-500",
  actionButton,
  children,
  highlight = false
}) => {
  if (count === 0 && !actionButton) return null;

  return (
    <div className="mb-8 last:mb-5 animate-in fade-in duration-500">
      <div 
        onClick={onToggle} 
        className="flex items-center justify-between bg-slate-750 p-2.5 px-4 rounded-full border border-slate-700 cursor-pointer hover:bg-slate-700 hover:shadow-soft transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={18} className={iconColorClass}/> : <ChevronRight size={18} className="text-slate-500"/>}
          <h3 className={`text-sm font-black flex items-center gap-2 tracking-tight ${titleColorClass}`}>
            <span className={iconColorClass}>{icon}</span> 
            {title} 
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full min-w-5 text-center shadow-inner">{count}</span>
          </h3>
        </div>
        {actionButton}
      </div>
      
      {isOpen && (
         <div className={highlight ? "animate-in fade-in slide-in-from-top-2 duration-300" : ""}>
            {children}
         </div>
      )}
    </div>
  );
};

export default DashboardSection;

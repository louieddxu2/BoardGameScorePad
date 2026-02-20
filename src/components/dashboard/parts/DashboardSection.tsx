
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
  titleColorClass = "text-white",
  iconColorClass = "text-slate-500",
  actionButton,
  children,
  highlight = false
}) => {
  if (count === 0 && !actionButton) return null;

  return (
    <div className="space-y-2">
      <div 
        onClick={onToggle} 
        className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={20} className={iconColorClass}/> : <ChevronRight size={20} className="text-slate-500"/>}
          <h3 className={`text-base font-bold flex items-center gap-2 ${titleColorClass}`}>
            <span className={iconColorClass}>{icon}</span> 
            {title} 
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{count}</span>
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

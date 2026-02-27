
import React, { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../db';
import { InspectorDetailPanel, useInspectorTranslation } from '../shared/InspectorCommon';

// --- Helpers for formatting ---
const getWeekdayName = (idx: number, t: (key: any) => string) => {
    return t(`day_${idx}`);
};

// Specialized Time Inspector with Split Left Pane
const TimeInspector = () => {
    const weekdays = useLiveQuery(() => db.savedWeekdays.toArray()) || [];
    const timeSlots = useLiveQuery(() => db.savedTimeSlots.toArray()) || [];
    const t = useInspectorTranslation();

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Local icon components for list
    const Calendar = (props: any) => <Clock {...props} />; // Placeholder
    const Watch = (props: any) => <Clock {...props} />;

    const selectedItem = useMemo(() => {
        return weekdays.find(i => i.id === selectedId) || timeSlots.find(i => i.id === selectedId);
    }, [selectedId, weekdays, timeSlots]);

    const SelectedIcon = selectedItem ? (selectedItem.id.startsWith('weekday') ? Calendar : Watch) : Clock;

    const renderListItem = (item: any, label: string) => {
        const isSelected = selectedId === item.id;
        return (
            <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'}`}
            >
                <span className="truncate font-bold flex items-center gap-1.5">
                    {label}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-700 text-slate-500'}`}>{item.usageCount || 0}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left Sidebar (Split Top/Bottom) */}
            <div className="w-1/3 border-r border-slate-700 flex flex-col bg-slate-900/50">
                <div className="flex-1 overflow-y-auto no-scrollbar border-b border-slate-700 flex flex-col min-h-0">
                    <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={12} /> {t('list_weekdays')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {weekdays.map(w => renderListItem(w, getWeekdayName(parseInt(w.name), t) || w.name))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
                    <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={12} /> {t('list_timeslots')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {timeSlots.map(t => renderListItem(t, t.name))}
                    </div>
                </div>
            </div>
            <InspectorDetailPanel selectedItem={selectedItem} icon={SelectedIcon} />
        </div>
    );
}

export default TimeInspector;

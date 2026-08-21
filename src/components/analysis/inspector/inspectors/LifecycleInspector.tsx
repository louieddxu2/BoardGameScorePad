import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../db';
import {
    GAME_LIFECYCLE_BUCKET_IDS,
    GAME_PLAY_STAGE_BUCKET_IDS,
    GAME_RECENCY_BUCKET_IDS
} from '../../../../services/relationship/GameTemporalContextResolver';
import { SavedListItem } from '../../../../types';
import { InspectorDetailPanel, useInspectorTranslation } from '../shared/InspectorCommon';
import { getLifecycleBucketLabel } from '../shared/lifecycleLabels';

const LifecycleInspector = () => {
    const t = useInspectorTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const items = useLiveQuery(
        () => db.savedGameLifecycleContexts.bulkGet([...GAME_LIFECYCLE_BUCKET_IDS]),
        [],
        []
    );

    const itemsById = useMemo(() => {
        const result = new Map<string, SavedListItem>();
        for (const item of items) {
            if (item) result.set(item.id, item);
        }
        return result;
    }, [items]);

    const selectedItem = selectedId ? itemsById.get(selectedId) : undefined;
    const selectedDisplayItem = selectedItem
        ? { ...selectedItem, name: getLifecycleBucketLabel(selectedItem.id, t) }
        : undefined;

    const renderGroup = (title: string, ids: readonly string[]) => (
        <div className="flex-1 overflow-y-auto no-scrollbar border-b border-surface-border last:border-b-0 flex flex-col min-h-0">
            <div className="p-2 sticky top-0 modal-bg-elevated border-b border-surface-border z-10 backdrop-blur-sm">
                <span className="text-xs font-bold text-txt-muted flex items-center gap-1">
                    <Activity size={12} /> {title}
                </span>
            </div>
            <div className="p-2 space-y-1">
                {ids.map(id => {
                    const item = itemsById.get(id);
                    if (!item) return null;
                    const isSelected = selectedId === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setSelectedId(id)}
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center active:scale-[0.98] ${isSelected ? 'bg-brand-primary text-white shadow-md' : 'modal-bg-elevated text-txt-secondary border border-surface-border/50 hover:modal-bg-recessed hover:text-txt-primary'}`}
                        >
                            <span className="truncate font-bold">{getLifecycleBucketLabel(id, t)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-surface-border/50 text-txt-muted'}`}>
                                {item.usageCount || 0}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flex flex-1 min-h-0">
            <div className="w-1/3 border-r border-surface-border flex flex-col modal-bg-recessed/30">
                {renderGroup(t('lifecycle_group_stage'), GAME_PLAY_STAGE_BUCKET_IDS)}
                {renderGroup(t('lifecycle_group_recency'), GAME_RECENCY_BUCKET_IDS)}
            </div>
            <InspectorDetailPanel selectedItem={selectedDisplayItem} icon={Activity} />
        </div>
    );
};

export default LifecycleInspector;

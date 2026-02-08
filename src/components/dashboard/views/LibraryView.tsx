
import React, { useState } from 'react';
import { GameTemplate } from '../../../types';
import { Activity, Pin, LayoutGrid, ArrowRightLeft, Plus, Library, Sparkles } from 'lucide-react';
import DashboardSection from '../parts/DashboardSection';
import GameCard from '../parts/GameCard';
import { useTranslation } from '../../../i18n';

interface LibraryViewProps {
  // Data
  activeGameItems: { template: GameTemplate, timestamp: number }[];
  pinnedTemplates: GameTemplate[];
  userTemplates: GameTemplate[];
  userTemplatesTotal: number;
  systemTemplates: GameTemplate[];
  systemTemplatesTotal: number;
  newBadgeIds: string[];
  searchQuery: string;
  copiedId: string | null;
  // Connection State
  isConnected: boolean;
  isAutoConnectEnabled: boolean;
  // Handlers
  onTemplateSelect: (template: GameTemplate) => void;
  onDirectResume: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClearAllSessions: () => void;
  onPin: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onCopyJSON: (template: GameTemplate, e: React.MouseEvent) => void;
  onCloudBackup: (template: GameTemplate, e: React.MouseEvent) => void;
  onOpenDataManager: () => void;
  onTemplateCreate: () => void;
  onClearNewBadges: () => void;
  onSystemCopy: (template: GameTemplate, e: React.MouseEvent) => void;
  onSystemRestore: (template: GameTemplate, e: React.MouseEvent) => void;
}

const TruncationFooter: React.FC<{ displayed: number, total: number }> = ({ displayed, total }) => {
    if (displayed >= total) return null;
    return (
        <div className="col-span-2 py-4 flex flex-col items-center justify-center text-slate-500 opacity-70">
            <div className="w-12 h-1 bg-slate-700/50 rounded-full mb-2"></div>
            <span className="text-[10px] font-mono">
                顯示 {displayed} 筆，共 {total} 筆
            </span>
        </div>
    );
};

export const LibraryView: React.FC<LibraryViewProps> = ({
  activeGameItems,
  pinnedTemplates,
  userTemplates,
  userTemplatesTotal,
  systemTemplates,
  systemTemplatesTotal,
  newBadgeIds,
  searchQuery,
  copiedId,
  isConnected,
  isAutoConnectEnabled,
  onTemplateSelect,
  onDirectResume,
  onDeleteSession,
  onClearAllSessions,
  onPin,
  onDeleteTemplate,
  onCopyJSON,
  onCloudBackup,
  onOpenDataManager,
  onTemplateCreate,
  onClearNewBadges,
  onSystemCopy,
  onSystemRestore
}) => {
  const { t } = useTranslation();
  
  // Section Toggles
  const [isActiveLibOpen, setIsActiveLibOpen] = useState(true);
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  const animClass = "animate-in fade-in slide-in-from-top-2 duration-300";
  const newSystemTemplatesCount = newBadgeIds.length;

  return (
    <>
        {/* Active Sessions - Only show if there are items */}
        {activeGameItems.length > 0 && (
            <DashboardSection 
                title={t('dash_active_sessions')}
                icon={<Activity size={18} />}
                count={activeGameItems.length}
                iconColorClass="text-emerald-400"
                isOpen={isActiveLibOpen}
                onToggle={() => setIsActiveLibOpen(!isActiveLibOpen)}
                actionButton={
                    <button onClick={(e) => { e.stopPropagation(); onClearAllSessions(); }} className="text-xs text-slate-500 hover:text-red-400 px-2 py-1">
                        {t('dash_clear_all')}
                    </button>
                }
            >
                <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                    {activeGameItems.map(item => (
                        <GameCard 
                            key={`active-${item.template.id}`}
                            template={item.template}
                            mode="active"
                            onClick={() => onDirectResume(item.template.id)}
                            onDelete={(e) => { e.stopPropagation(); onDeleteSession(item.template.id); }}
                        />
                    ))}
                </div>
            </DashboardSection>
        )}

        <DashboardSection 
            title={t('dash_pinned')}
            icon={<Pin size={18} />}
            count={pinnedTemplates.length}
            iconColorClass="text-yellow-400"
            isOpen={isPinnedLibOpen}
            onToggle={() => setIsPinnedLibOpen(!isPinnedLibOpen)}
        >
            <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                {pinnedTemplates.map(t => (
                    <GameCard 
                        key={`pinned-${t.id}`}
                        template={t}
                        mode="pinned"
                        onClick={() => onTemplateSelect(t)}
                        onPin={(e) => { e.stopPropagation(); onPin(t.id); }}
                        onCopyJSON={(e) => onCopyJSON(t, e)}
                        isCopied={copiedId === t.id}
                        isConnected={isConnected}
                        isAutoConnectEnabled={isAutoConnectEnabled}
                    />
                ))}
            </div>
        </DashboardSection>

        <DashboardSection 
            title={t('dash_my_library')}
            icon={<LayoutGrid size={18} />}
            count={userTemplatesTotal}
            iconColorClass="text-emerald-500"
            isOpen={isUserLibOpen}
            onToggle={() => setIsUserLibOpen(!isUserLibOpen)}
            actionButton={
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onOpenDataManager(); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title={t('dash_import_export')}><ArrowRightLeft size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95"><Plus size={14} /> {t('dash_add_new')}</button>
                </div>
            }
        >
            <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                {userTemplates.map(t => (
                    <GameCard 
                        key={t.id}
                        template={t}
                        mode="user"
                        onClick={() => onTemplateSelect(t)}
                        onPin={(e) => { e.stopPropagation(); onPin(t.id); }}
                        onDelete={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                        onCopyJSON={(e) => onCopyJSON(t, e)}
                        onCloudBackup={(e) => onCloudBackup(t, e)}
                        isCopied={copiedId === t.id}
                        isConnected={isConnected}
                        isAutoConnectEnabled={isAutoConnectEnabled}
                    />
                ))}
                {/* SearchEmptyState is removed here as "Create" logic is moved to StartGamePanel */}
                <TruncationFooter displayed={userTemplates.length} total={userTemplatesTotal} />
            </div>
        </DashboardSection>

        <DashboardSection 
            title={t('dash_builtin_library')}
            icon={<Library size={18} />}
            count={systemTemplatesTotal}
            iconColorClass="text-indigo-400"
            isOpen={isSystemLibOpen}
            onToggle={() => setIsSystemLibOpen(!isSystemLibOpen)}
            highlight={newSystemTemplatesCount > 0 && !searchQuery}
            actionButton={
                newSystemTemplatesCount > 0 && !searchQuery ? (
                    <button onClick={(e) => { e.stopPropagation(); onClearNewBadges(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
                        <Sparkles size={14} /> {t('dash_new_games_found', { count: newSystemTemplatesCount })}
                    </button>
                ) : undefined
            }
        >
            <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                {systemTemplates.map(t => {
                    const isNew = newBadgeIds.includes(t.id);
                    return (
                        <div key={t.id} className="relative">
                            {isNew && (
                                <div className="absolute -top-1 -right-1 z-10 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-md animate-bounce" />
                            )}
                            <GameCard 
                                template={t}
                                mode="system"
                                onClick={() => onTemplateSelect(t)}
                                onPin={(e) => { e.stopPropagation(); onPin(t.id); }}
                                onCopyJSON={(e) => onCopyJSON(t, e)}
                                onSystemCopy={(e) => onSystemCopy(t, e)}
                                onSystemRestore={(e) => { e.stopPropagation(); onSystemRestore(t, e); }}
                                isCopied={copiedId === t.id}
                                systemOverride={!!t.sourceTemplateId}
                            />
                        </div>
                    );
                })}
                <TruncationFooter displayed={systemTemplates.length} total={systemTemplatesTotal} />
            </div>
        </DashboardSection>
    </>
  );
};

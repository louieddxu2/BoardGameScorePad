
import React, { useState } from 'react';
import { GameTemplate, GameSession } from '../../../types';
import { Activity, Pin, LayoutGrid, ArrowRightLeft, Plus, Library, Sparkles } from 'lucide-react';
import DashboardSection from '../parts/DashboardSection';
import GameCard from '../parts/GameCard';
import { useDashboardTranslation } from '../../../i18n/dashboard';

interface LibraryViewProps {
    // Data
    activeSessions: GameSession[];
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
    onCopyTemplateShareLink: (template: GameTemplate, e: React.MouseEvent) => void;
    onCopyShareLink: (template: GameTemplate, e: React.MouseEvent) => void;
    onCloudBackup: (template: GameTemplate, e: React.MouseEvent) => void;
    onOpenDataManager: () => void;
    onTemplateCreate: () => void;
    onClearNewBadges: () => void;
    onSystemCopy: (template: GameTemplate, e: React.MouseEvent) => void;
    onSystemRestore: (template: GameTemplate, e: React.MouseEvent) => void;
}

const TruncationFooter: React.FC<{ displayed: number, total: number, label: string }> = ({ displayed, total, label }) => {
    if (displayed >= total) return null;
    return (
        <div className="col-span-2 py-4 flex flex-col items-center justify-center text-slate-500 opacity-70">
            <div className="w-12 h-1 bg-slate-700/50 rounded-full mb-2"></div>
            <span className="text-[10px] font-mono">{label}</span>
        </div>
    );
};

export const LibraryView: React.FC<LibraryViewProps> = ({
    activeSessions,
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
    onCopyTemplateShareLink,
    onCopyShareLink,
    onCloudBackup,
    onOpenDataManager,
    onTemplateCreate,
    onClearNewBadges,
    onSystemCopy,
    onSystemRestore
}) => {
    const { t } = useDashboardTranslation();

    // Section Toggles
    const [isActiveLibOpen, setIsActiveLibOpen] = useState(true);
    const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
    const [isUserLibOpen, setIsUserLibOpen] = useState(true);
    const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

    const animClass = "animate-in fade-in slide-in-from-top-2 duration-300";
    const newSystemTemplatesCount = newBadgeIds.length;

    return (
        <>
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
                <DashboardSection
                    title={t('dash_active_sessions')}
                    icon={<Activity size={18} />}
                    count={activeSessions.length}
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
                        {activeSessions.map(session => (
                            <GameCard
                                key={`active-${session.id}`}
                                template={{
                                    id: session.templateId,
                                    name: session.name || t('dash_unnamed_session'),
                                    bggId: session.bggId,
                                } as GameTemplate}
                                mode="active"
                                onClick={() => onDirectResume(session.templateId)}
                                onDelete={(e) => { e.stopPropagation(); onDeleteSession(session.templateId); }}
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
                    {pinnedTemplates.map(tData => (
                        <GameCard
                            key={`pinned-${tData.id}`}
                            template={tData}
                            mode="pinned"
                            onClick={() => onTemplateSelect(tData)}
                            onPin={(e) => { e.stopPropagation(); onPin(tData.id); }}
                            onCopyLink={(e) => { e.stopPropagation(); onCopyTemplateShareLink(tData, e); }}
                            isCopied={copiedId === tData.id}
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
                        <button onClick={(e) => { e.stopPropagation(); onOpenDataManager(); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none" title={t('dash_import_export')}><ArrowRightLeft size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95 focus:outline-none"><Plus size={14} /> {t('dash_add_new')}</button>
                    </div>
                }
            >
                <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                    {userTemplates.map(tData => (
                        <GameCard
                            key={tData.id}
                            template={tData}
                            mode="user"
                            onClick={() => onTemplateSelect(tData)}
                            onPin={(e) => { e.stopPropagation(); onPin(tData.id); }}
                            onDelete={(e) => { e.stopPropagation(); onDeleteTemplate(tData.id); }}
                            onCopyLink={(e) => { e.stopPropagation(); onCopyTemplateShareLink(tData, e); }}
                            onCloudBackup={(e) => { e.stopPropagation(); onCloudBackup(tData, e); }}
                            isCopied={copiedId === tData.id}
                            isConnected={isConnected}
                            isAutoConnectEnabled={isAutoConnectEnabled}
                        />
                    ))}
                    <TruncationFooter displayed={userTemplates.length} total={userTemplatesTotal} label={t('dash_footer_count', { displayed: userTemplates.length, total: userTemplatesTotal })} />
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
                        <button onClick={(e) => { e.stopPropagation(); onClearNewBadges(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                            <Sparkles size={14} /> {t('dash_new_games_found', { count: newSystemTemplatesCount })}
                        </button>
                    ) : undefined
                }
            >
                <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                    {systemTemplates.map(tData => {
                        const isNew = newBadgeIds.includes(tData.id);
                        return (
                            <div key={tData.id} className="relative">
                                {isNew && (
                                    <div className="absolute -top-1 -right-1 z-10 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-md animate-bounce" />
                                )}
                                <GameCard
                                    template={tData}
                                    mode="system"
                                    onClick={() => onTemplateSelect(tData)}
                                    onPin={(e) => { e.stopPropagation(); onPin(tData.id); }}
                                    onCopyLink={(e) => {
                                        e.stopPropagation();
                                        if (tData.sourceTemplateId) onCopyTemplateShareLink(tData, e);
                                        else onCopyShareLink(tData, e);
                                    }}
                                    onSystemCopy={(e) => { e.stopPropagation(); onSystemCopy(tData, e); }}
                                    onSystemRestore={(e) => { e.stopPropagation(); onSystemRestore(tData, e); }}
                                    isCopied={copiedId === tData.id}
                                    systemOverride={!!tData.sourceTemplateId}
                                />
                            </div>
                        );
                    })}
                    <TruncationFooter displayed={systemTemplates.length} total={systemTemplatesTotal} label={t('dash_footer_count', { displayed: systemTemplates.length, total: systemTemplatesTotal })} />
                </div>
            </DashboardSection>
        </>
    );
};

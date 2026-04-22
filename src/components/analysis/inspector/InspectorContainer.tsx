
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Users, MapPin, Clock, Hash, LayoutGrid, Zap, Image as ImageIcon, HardDrive, RefreshCw, Trash2, Trophy } from 'lucide-react';
import { db } from '../../../db';
import { DataList, useInspectorTranslation } from './shared/InspectorCommon';
import { useMaintenance } from './hooks/useMaintenance';
import { useConfirm } from '../../../hooks/useConfirm';

// Inspectors
import TimeInspector from './inspectors/TimeInspector';
import WeightsInspector from './inspectors/WeightsInspector';
import ImageInspector from './inspectors/ImageInspector';
import DatabaseInspector from './inspectors/DatabaseInspector';

const InspectorContainer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'games' | 'players' | 'locations' | 'time' | 'counts' | 'modes' | 'weights' | 'images' | 'bgg' | 'session' | 'db'>('games');
    const { confirm } = useConfirm();

    const t = useInspectorTranslation();
    const {
        isProcessing,
        progress,
        executeResetStats,
        executeReprocessHistory,
        executeFactoryReset
    } = useMaintenance();

    const handleResetStats = async () => {
        if (await confirm({
            title: t('confirm_reset_title'),
            message: t('confirm_reset_msg'),
            confirmText: t('btn_reset'),
            isDangerous: true
        })) {
            await executeResetStats();
        }
    };

    const handleReprocessHistory = async () => {
        if (await confirm({
            title: t('confirm_reprocess_title'),
            message: t('confirm_reprocess_msg'),
            confirmText: t('btn_reprocess')
        })) {
            await executeReprocessHistory();
        }
    };

    const handleFactoryReset = async () => {
        if (await confirm({
            title: t('confirm_factory_reset_title'),
            message: t('confirm_factory_reset_msg'),
            confirmText: t('btn_factory_reset'),
            isDangerous: true
        })) {
            await executeFactoryReset();
        }
    };

    const tabs = [
        { id: 'games', label: t('tab_games'), icon: LayoutGrid },
        { id: 'players', label: t('tab_players'), icon: Users },
        { id: 'locations', label: t('tab_locations'), icon: MapPin },
        { id: 'time', label: t('tab_time'), icon: Clock },
        { id: 'counts', label: t('tab_counts'), icon: Hash },
        { id: 'modes', label: t('tab_modes'), icon: Trophy },
        { id: 'session', label: t('tab_session'), icon: Zap },
        { id: 'weights', label: t('tab_weights'), icon: Users },
        { id: 'images', label: t('tab_images'), icon: ImageIcon },
        { id: 'bgg', label: t('tab_bgg'), icon: Database },
        { id: 'db', label: t('tab_db'), icon: HardDrive },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-app-bg flex flex-col animate-in fade-in duration-200">

            {/* Header */}
            <div className="flex-none modal-bg-elevated p-3 border-b border-surface-border flex justify-between items-center shadow-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-primary/10 p-2 rounded-lg border border-brand-primary/20">
                        <Database size={18} className="text-brand-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-txt-primary leading-tight">{t('title')}</h3>
                        <span className="text-[10px] text-txt-muted block">{t('subtitle')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleResetStats}
                        disabled={isProcessing}
                        className="p-2 hover:modal-bg-recessed rounded-lg text-status-danger hover:brightness-110 transition-colors disabled:opacity-50"
                        title={t('tooltip_reset')}
                    >
                        <Trash2 size={20} />
                    </button>
                    <button
                        onClick={handleReprocessHistory}
                        disabled={isProcessing}
                        className="p-2 hover:modal-bg-recessed rounded-lg text-brand-secondary hover:brightness-110 transition-colors disabled:opacity-50 relative overflow-hidden"
                        title={t('tooltip_reprocess')}
                    >
                        {isProcessing ? (
                            <>
                                <div className="absolute inset-0 bg-brand-secondary/20" style={{ width: `${progress}%` }}></div>
                                <span className="relative text-[10px] font-bold">{progress}%</span>
                            </>
                        ) : (
                            <RefreshCw size={20} />
                        )}
                    </button>
                    <div className="w-px h-6 bg-surface-border mx-1"></div>
                    <button onClick={onClose} className="p-2 hover:modal-bg-recessed rounded-lg text-txt-muted hover:text-txt-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-none modal-bg-elevated border-b border-surface-border flex px-2 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-brand-primary text-brand-primary bg-surface-border/30' : 'border-transparent text-txt-muted hover:text-txt-primary hover:bg-surface-border/20'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 flex flex-col bg-app-bg relative">
                {activeTab === 'games' && <DataList title={t('list_games')} table={db.savedGames} icon={LayoutGrid} />}
                {activeTab === 'players' && <DataList title={t('list_players')} table={db.savedPlayers} icon={Users} />}
                {activeTab === 'locations' && <DataList title={t('list_locations')} table={db.savedLocations} icon={MapPin} />}
                {activeTab === 'time' && <TimeInspector />}
                {activeTab === 'counts' && <DataList title={t('list_counts')} table={db.savedPlayerCounts} icon={Hash} />}
                {activeTab === 'modes' && <DataList title={t('list_modes')} table={db.savedGameModes} icon={Trophy} />}
                {activeTab === 'weights' && <WeightsInspector />}
                {activeTab === 'images' && <ImageInspector />}
                {activeTab === 'bgg' && <DataList title={t('list_bgg')} table={db.bggGames} icon={Database} isBGG={true} />}
                {activeTab === 'session' && <DataList title={t('list_session')} table={db.savedCurrentSession} icon={Zap} />}
                {activeTab === 'db' && <DatabaseInspector onRequestFactoryReset={handleFactoryReset} />}
            </div>
        </div>,
        document.body
    );
};

export default InspectorContainer;

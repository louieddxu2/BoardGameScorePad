
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Users, MapPin, Clock, Hash, LayoutGrid, Zap, Image as ImageIcon, HardDrive, RefreshCw, Trash2, Trophy } from 'lucide-react';
import { db } from '../../../db';
import { DataList, useInspectorTranslation } from './shared/InspectorCommon';
import { useMaintenance } from './hooks/useMaintenance';
import ConfirmationModal from '../../shared/ConfirmationModal';

// Inspectors
import TimeInspector from './inspectors/TimeInspector';
import WeightsInspector from './inspectors/WeightsInspector';
import ImageInspector from './inspectors/ImageInspector';
import DatabaseInspector from './inspectors/DatabaseInspector';

const InspectorContainer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'games' | 'players' | 'locations' | 'time' | 'counts' | 'modes' | 'weights' | 'images' | 'bgg' | 'session' | 'db'>('games');
    const [confirmAction, setConfirmAction] = useState<'reset' | 'reprocess' | 'factory_reset' | null>(null);

    const t = useInspectorTranslation();
    const {
        isProcessing,
        progress,
        executeResetStats,
        executeReprocessHistory,
        executeFactoryReset
    } = useMaintenance();

    const handleConfirmAction = async () => {
        if (confirmAction === 'reset') {
            await executeResetStats();
        } else if (confirmAction === 'reprocess') {
            await executeReprocessHistory();
        } else if (confirmAction === 'factory_reset') {
            await executeFactoryReset();
        }
        setConfirmAction(null);
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
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in duration-200">
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmAction}
                title={
                    confirmAction === 'factory_reset' ? t('confirm_factory_reset_title') :
                        confirmAction === 'reset' ? t('confirm_reset_title') :
                            t('confirm_reprocess_title')
                }
                message={
                    confirmAction === 'factory_reset' ? t('confirm_factory_reset_msg') :
                        confirmAction === 'reset' ? t('confirm_reset_msg') :
                            t('confirm_reprocess_msg')
                }
                confirmText={
                    confirmAction === 'factory_reset' ? t('btn_factory_reset') :
                        confirmAction === 'reset' ? t('btn_reset') :
                            t('btn_reprocess')
                }
                isDangerous={confirmAction === 'reset' || confirmAction === 'factory_reset'}
                zIndexClass="z-[110]"
                onCancel={() => setConfirmAction(null)}
                onConfirm={handleConfirmAction}
            />

            {/* Header */}
            <div className="flex-none bg-slate-900 p-3 border-b border-slate-800 flex justify-between items-center shadow-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <Database size={18} className="text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight">{t('title')}</h3>
                        <span className="text-[10px] text-slate-500 block">{t('subtitle')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setConfirmAction('reset')}
                        disabled={isProcessing}
                        className="p-2 hover:bg-slate-800 rounded-lg text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title={t('tooltip_reset')}
                    >
                        <Trash2 size={20} />
                    </button>
                    <button
                        onClick={() => setConfirmAction('reprocess')}
                        disabled={isProcessing}
                        className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 relative overflow-hidden"
                        title={t('tooltip_reprocess')}
                    >
                        {isProcessing ? (
                            <>
                                <div className="absolute inset-0 bg-indigo-500/20" style={{ width: `${progress}%` }}></div>
                                <span className="relative text-[10px] font-bold">{progress}%</span>
                            </>
                        ) : (
                            <RefreshCw size={20} />
                        )}
                    </button>
                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-none bg-slate-900 border-b border-slate-800 flex px-2 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 flex flex-col bg-black relative">
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
                {activeTab === 'db' && <DatabaseInspector onRequestFactoryReset={() => setConfirmAction('factory_reset')} />}
            </div>
        </div>,
        document.body
    );
};

export default InspectorContainer;

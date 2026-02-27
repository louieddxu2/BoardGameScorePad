
import { useState } from 'react';
import { db } from '../../../../db';
import Dexie from 'dexie';
import { relationshipService } from '../../../../services/relationshipService';
import { useToast } from '../../../../hooks/useToast';
import { useInspectorTranslation } from '../shared/InspectorCommon';

export const useMaintenance = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const t = useInspectorTranslation();
    const { showToast } = useToast();

    const executeResetStats = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await (db as any).transaction('rw', db.savedPlayers, db.savedLocations, db.savedGames, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.savedGameModes, db.analyticsLogs, async () => {
                await db.analyticsLogs.clear();
                await db.savedPlayers.clear();
                await db.savedLocations.clear();
                await db.savedGames.clear();
                await db.savedWeekdays.clear();
                await db.savedTimeSlots.clear();
                await db.savedPlayerCounts.clear();
                await db.savedGameModes.clear();
            });
            showToast({ message: t('toast_reset_success'), type: 'success' });
        } catch (error) {
            console.error("Reset failed", error);
            showToast({ message: t('toast_reset_failed'), type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const executeReprocessHistory = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProgress(0);
        try {
            const allHistory = await db.history.orderBy('endTime').toArray();
            const total = allHistory.length;
            let count = 0;
            const CHUNK_SIZE = 200;

            for (let i = 0; i < total; i += CHUNK_SIZE) {
                const chunk = allHistory.slice(i, i + CHUNK_SIZE);
                await relationshipService.processHistoryBatch(chunk);
                count += chunk.length;
                setProgress(Math.min(100, Math.round((count / total) * 100)));
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            showToast({ message: t('toast_reprocess_success', { count: total }), type: 'success' });
        } catch (error) {
            console.error("Reprocess failed", error);
            showToast({ message: t('toast_reprocess_failed'), type: 'error' });
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    };

    const executeFactoryReset = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            (db as any).close();
            await Dexie.delete('BoardGameScorePadDB');
            localStorage.clear();
            window.location.reload();
        } catch (error) {
            console.error("Factory Reset failed", error);
            window.location.reload();
        }
    };

    return {
        isProcessing,
        progress,
        executeResetStats,
        executeReprocessHistory,
        executeFactoryReset
    };
};

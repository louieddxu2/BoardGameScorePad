import type { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import type { CloudFile } from '../../../services/googleDrive';

// Helper to extract ID (Parse by last underscore)
export const extractCloudLocalId = (name: string) => {
    const lastUnderscoreIndex = name.lastIndexOf('_');
    if (lastUnderscoreIndex !== -1) {
        return name.substring(lastUnderscoreIndex + 1);
    }
    return null;
};

export function calculateCloudScanStats(
    localData: { data: { templates?: GameTemplate[]; overrides?: GameTemplate[]; sessions?: GameSession[]; history?: HistoryRecord[] } },
    cTemplates: CloudFile[],
    cSessions: CloudFile[],
    cHistory: CloudFile[]
) {
    const stats = {
        upload: { templates: 0, sessions: 0, history: 0 },
        download: { templates: 0, sessions: 0, history: 0 }
    };

    const buildCloudMap = (files: CloudFile[]) => {
        const map = new Map<string, CloudFile>();
        files.forEach(f => {
            const id = extractCloudLocalId(f.name);
            if (id) map.set(id, f);
        });
        return map;
    };

    const mapT = buildCloudMap(cTemplates);
    const mapS = buildCloudMap(cSessions);
    const mapH = buildCloudMap(cHistory);

    // 1. Compare Templates
    const localTemplates = [...(localData.data.templates || []), ...(localData.data.overrides || [])];
    localTemplates.forEach((t: GameTemplate) => {
        const cFile = mapT.get(t.id);
        if (!cFile) {
            stats.upload.templates++;
        } else {
            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
            if ((t.updatedAt || 0) > cTime) stats.upload.templates++;
        }
    });
    cTemplates.forEach(f => {
        const id = extractCloudLocalId(f.name);
        if (id) {
            const lTemp = localTemplates.find((t: any) => t.id === id);
            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
            if (!lTemp) {
                stats.download.templates++;
            } else {
                if (cTime > (lTemp.updatedAt || 0)) stats.download.templates++;
            }
        }
    });

    // 2. Compare Sessions
    const localSessions = localData.data.sessions || [];
    localSessions.forEach((s: GameSession) => {
        const cFile = mapS.get(s.id);
        if (!cFile) {
            stats.upload.sessions++;
        } else {
            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
            const lTime = s.lastUpdatedAt || s.startTime || 0;
            if (lTime > cTime) stats.upload.sessions++;
        }
    });
    cSessions.forEach(f => {
        const id = extractCloudLocalId(f.name);
        if (id) {
            const lSession = localSessions.find((s: any) => s.id === id);
            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
            if (!lSession) {
                stats.download.sessions++;
            } else {
                const lTime = lSession.lastUpdatedAt || lSession.startTime || 0;
                if (cTime > lTime) stats.download.sessions++;
            }
        }
    });

    // 3. Compare History
    const localHistory = localData.data.history || [];
    localHistory.forEach((h: HistoryRecord) => {
        const cFile = mapH.get(h.id);
        if (!cFile) {
            stats.upload.history++;
        } else {
            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
            const localTime = h.updatedAt || h.endTime;
            if (localTime > cTime) stats.upload.history++;
        }
    });
    cHistory.forEach(f => {
        const id = extractCloudLocalId(f.name);
        if (id) {
            const lHistory = localHistory.find((h: any) => h.id === id);
            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
            if (!lHistory) {
                stats.download.history++;
            } else {
                const lTime = lHistory.updatedAt || lHistory.endTime;
                if (cTime > lTime) stats.download.history++;
            }
        }
    });

    return stats;
}

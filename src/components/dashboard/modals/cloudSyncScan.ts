import type { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import type { CloudFile } from '../../../services/cloud/types';
import { extractCloudLocalId, getCloudUpdatedAt } from '../../../services/cloud/cloudMetadata';

/** Compare loaded metadata in O(local + cloud), without reading any stored data. */
function compareCloudCategory<T extends { id: string }>(
    localItems: T[],
    cloudFiles: CloudFile[],
    getLocalUpdatedAt: (item: T) => number
) {
    if (localItems.length === 0 && cloudFiles.length === 0) return { upload: 0, download: 0 };

    const cloudById = new Map<string, CloudFile>();
    for (const file of cloudFiles) {
        const id = extractCloudLocalId(file.name);
        if (id) cloudById.set(id, file); // Preserve the last cloud file for uploads.
    }

    const localTimes = new Map<string, number>();
    let upload = 0;
    let download = 0;
    for (const item of localItems) {
        const id = item.id;
        const localTime = getLocalUpdatedAt(item);
        // Downloads previously used Array.find: the first local match wins.
        if (!localTimes.has(id)) localTimes.set(id, localTime);
        const cloudFile = cloudById.get(id);
        if (!cloudFile || localTime > getCloudUpdatedAt(cloudFile)) upload++;
    }

    for (const file of cloudFiles) {
        const id = extractCloudLocalId(file.name);
        if (!id) continue;
        if (!localTimes.has(id) || getCloudUpdatedAt(file) > localTimes.get(id)!) download++;
    }
    return { upload, download };
}

export function calculateCloudScanStats(
    localData: { data: { templates?: GameTemplate[]; overrides?: GameTemplate[]; sessions?: GameSession[]; history?: HistoryRecord[] } },
    cTemplates: CloudFile[],
    cSessions: CloudFile[],
    cHistory: CloudFile[]
) {
    const templates = compareCloudCategory(
        [...(localData.data.templates || []), ...(localData.data.overrides || [])],
        cTemplates, template => template.updatedAt || 0
    );
    const sessions = compareCloudCategory(
        localData.data.sessions || [], cSessions, session => session.lastUpdatedAt || session.startTime || 0
    );
    const history = compareCloudCategory(
        localData.data.history || [], cHistory, record => record.updatedAt || record.endTime
    );

    return {
        upload: { templates: templates.upload, sessions: sessions.upload, history: history.upload },
        download: { templates: templates.download, sessions: sessions.download, history: history.download }
    };
}

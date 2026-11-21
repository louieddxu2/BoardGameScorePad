import { db } from '../db';
import {
    downloadOfficialVersion, getOfficialTemplateAtVersion, isOfficialTemplateId, keepOfficialVersionForSession, localOfficialVersion,
    START_DOWNLOAD_TIMEOUT_MS,
} from '../features/official-boards/officialBoards';
import type { GameSession, GameTemplate } from '../types';
import { recalculateScoreSession } from '../utils/sessionScoring';
import { loadSessionActivation } from './sessionActivation';

type ResumeOptions = {
    confirmReplacement?: () => Promise<boolean>;
    notifyUnavailable: () => void;
};

const findActiveRoom = (sessionId: string) =>
    db.multiplayerRooms.where('sessionId').equals(sessionId).and(room => room.status !== 'completed').first();

const findReplacement = async (id: string, originalVersion: number, local: GameTemplate | null, isCurrent: () => boolean) => {
    const saved = await db.officialVersions.where('id').equals(id).toArray();
    let candidate = local;
    for (const record of saved) {
        if (record.version > localOfficialVersion(candidate)) candidate = record.template;
    }
    if (candidate && localOfficialVersion(candidate) > originalVersion) return candidate;
    if (!isCurrent() || navigator.onLine === false) return null;
    const latest = await downloadOfficialVersion(id, undefined, { install: false, timeoutMs: START_DOWNLOAD_TIMEOUT_MS }).catch(() => null);
    return latest && localOfficialVersion(latest) > originalVersion ? latest : null;
};

/** Prefer the original version, and change a saved session only after explicit approval. */
export const loadSessionForResume = async (
    session: GameSession,
    getTemplate: (id: string) => Promise<GameTemplate | null>,
    isCurrent: () => boolean,
    { confirmReplacement, notifyUnavailable }: ResumeOptions,
) => {
    const id = session.templateId;
    const local = await getTemplate(id);
    if (!isCurrent()) return null;

    const recoverLegacyBuiltin = !local && !!confirmReplacement;
    if (!isOfficialTemplateId(id) || (session.officialVersion === undefined && !recoverLegacyBuiltin)) {
        return loadSessionActivation(session, async () => local, isCurrent);
    }

    const originalVersion = session.officialVersion ?? 0;
    const original = local && localOfficialVersion(local) === originalVersion
        ? local
        : await getOfficialTemplateAtVersion(id, originalVersion);
    if (!isCurrent()) return null;
    if (original) return loadSessionActivation({ ...session, officialVersion: originalVersion }, async () => original, isCurrent);
    if (!confirmReplacement || await findActiveRoom(session.id)) {
        if (!isCurrent()) return null;
        notifyUnavailable();
        return null;
    }

    const replacement = await findReplacement(id, originalVersion, local, isCurrent);
    if (!isCurrent()) return null;
    if (!replacement) {
        notifyUnavailable();
        return null;
    }
    if (!await confirmReplacement() || !isCurrent()) return null;

    const loaded = await loadSessionActivation(
        { ...session, officialVersion: localOfficialVersion(replacement) },
        async () => replacement,
        isCurrent,
    );
    if (!loaded) return null;

    // The old board is unavailable. Stable column IDs are the only safe way to match saved inputs.
    let persisted = false;
    try {
        const adopted = recalculateScoreSession(loaded.session, loaded.template);
        persisted = await db.transaction('rw', db.sessions, db.multiplayerRooms, db.builtins, db.officialVersions, async () => {
            const current = await db.sessions.get(session.id);
            if (await findActiveRoom(session.id)) return false;
            if (!isCurrent() || JSON.stringify(current) !== JSON.stringify(session)) return false;
            await keepOfficialVersionForSession(loaded.template);
            if (!isCurrent()) return false;
            await db.sessions.put(adopted);
            return true;
        });
        if (persisted) return { ...loaded, session: adopted };
        if (isCurrent()) notifyUnavailable();
        return null;
    } finally {
        // The caller takes ownership of the URL only after successful persistence.
        if (!persisted && loaded.imageUrl) URL.revokeObjectURL(loaded.imageUrl);
    }
};

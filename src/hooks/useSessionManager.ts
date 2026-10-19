
import { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { GameTemplate, GameSession, Player, ScoringRule, HistoryRecord } from '../types';
import { generateId } from '../utils/idGenerator';
import { migrateTemplate } from '../utils/dataMigration';
import { loadSessionActivation } from './sessionActivation';
import { applyTemplateToSession } from '../utils/sessionTemplateUpdate';
import { calculateScoreSession } from '../utils/sessionScoring';
import { imageService } from '../services/imageService';
import { googleDriveService } from '../services/googleDrive';
import { backupActiveSessionToCloud, backupHistoryRecordToCloud } from './sessionCloudBackup';
import { cleanupService } from '../services/cleanupService';
import { relationshipService } from '../services/relationshipService';
import { applyRecommendationsToPlayers } from '../features/recommendation/SessionPlayerInitializer'; // [Refactor] New Import
import { useToast } from './useToast';
import { COLORS } from '../colors';
import { useLibrary } from './useLibrary';
import { useSessionTranslation } from '../i18n/session';
import { isDisposableTemplate, calculateWinners, prepareTemplateForSave } from '../utils/templateUtils';
import { deleteSessionRecord, deleteSessionRecords, notifySessionDeleted } from '../features/multiplayer/sessionDeletionEvents';

interface UseSessionManagerProps {
    getTemplate: (id: string) => Promise<GameTemplate | null>;
    activeSessions: GameSession[] | undefined;
    isCloudEnabled: () => boolean;
    pinnedIds: string[];
}

export interface SessionUpdateOptions {
    /** Adopt the canonical result only after the multiplayer controller has saved it. */
    alreadyPersisted?: boolean;
    /** A room handoff keeps the accepted structure and inputs together. */
    template?: GameTemplate;
}

export const useSessionManager = ({
    getTemplate,
    activeSessions,
    isCloudEnabled,
    pinnedIds
}: UseSessionManagerProps) => {

    const { showToast } = useToast();
    const { t } = useSessionTranslation();
    const { updatePlayer } = useLibrary();

    const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
    const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
    const [sessionImage, setSessionImage] = useState<string | null>(null);
    const [sessionPlayerCount, setSessionPlayerCount] = useState<number | null>(null);

    const isImageDirtyRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autosaveInFlightRef = useRef<Promise<unknown> | null>(null);
    const autosaveGenerationRef = useRef(0);
    const persistedSessionRef = useRef<GameSession | null>(null);
    const activationRef = useRef({ version: 0, mounted: true });

    useEffect(() => {
        activationRef.current.mounted = true;
        return () => {
            activationRef.current.mounted = false;
            activationRef.current.version += 1;
        };
    }, []);

    const beginActivation = (shouldActivate?: () => boolean) => {
        const version = ++activationRef.current.version;
        return () => activationRef.current.mounted && activationRef.current.version === version
            && shouldActivate?.() !== false;
    };

    useEffect(() => {
        return () => {
            if (sessionImage && sessionImage.startsWith('blob:')) {
                URL.revokeObjectURL(sessionImage);
            }
        };
    }, [sessionImage]);

    useEffect(() => {
        if (!currentSession || currentSession === persistedSessionRef.current) return;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        const generation = autosaveGenerationRef.current;
        saveTimeoutRef.current = setTimeout(() => {
            saveTimeoutRef.current = null;
            if (generation !== autosaveGenerationRef.current) return;
            const write = db.sessions.put(currentSession).catch(err => {
                console.error("Failed to autosave:", err);
            });
            autosaveInFlightRef.current = write;
            void write.finally(() => {
                if (autosaveInFlightRef.current === write) autosaveInFlightRef.current = null;
            });
        }, 1000);
        return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
    }, [currentSession]);

    const cancelPendingAutosave = () => {
        autosaveGenerationRef.current += 1;
        if (!saveTimeoutRef.current) return;
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
    };

    const waitForPendingAutosave = async () => {
        const pending = autosaveInFlightRef.current;
        if (pending) await pending;
    };

    const startSession = async (
        partialTemplate: GameTemplate,
        playerCount: number,
        options?: { startTimeStr?: string, scoringRule?: ScoringRule, location?: string, locationId?: string }
    ): Promise<string | null> => {
        const isCurrent = beginActivation();
        if (!isCurrent()) return null;
        setSessionPlayerCount(playerCount);
        const scoringRule = options?.scoringRule || 'HIGHEST_WINS';
        try {
            await db.templatePrefs.put({
                templateId: partialTemplate.id,
                lastPlayerCount: playerCount,
                defaultScoringRule: scoringRule,
                updatedAt: Date.now()
            });
        } catch (e) { console.warn("Failed to save preferences", e); }

        if (!isCurrent()) return null;
        const fullTemplate = await getTemplate(partialTemplate.id);
        if (!isCurrent()) return null;
        if (!fullTemplate) {
            showToast({ message: t('msg_template_read_failed'), type: 'error' });
            return null;
        }
        const migratedTemplate = migrateTemplate(fullTemplate);
        migratedTemplate.lastPlayerCount = playerCount;
        migratedTemplate.defaultScoringRule = scoringRule;

        const hasTexture = !!migratedTemplate.globalVisuals || !!migratedTemplate.hasImage;

        // [Color Logic Update]
        // 1. Get Preferred colors
        const preferred = migratedTemplate.supportedColors || [];
        // 2. Get Remaining colors (System colors excluding preferred ones)
        const remaining = COLORS.filter(c => !preferred.includes(c));
        // 3. Combine: Preferred first, then remaining
        const fullPalette = [...preferred, ...remaining];

        const defaultColors = hasTexture
            ? Array(playerCount).fill('transparent')
            : Array.from({ length: playerCount }, (_, i) => fullPalette[i % fullPalette.length]);

        const players: Player[] = Array.from({ length: playerCount }, (_, i) => {
            return {
                id: `player_${i + 1}`,
                name: `${t('player_default_name')} ${i + 1}`,
                scores: {},
                totalScore: 0,
                color: defaultColors[i],
                isIdentityManuallySet: false,
                isColorManuallySet: false // Init to false
            };
        });

        let startTime = Date.now();
        if (options?.startTimeStr) {
            const [hours, minutes] = options.startTimeStr.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                const date = new Date();
                date.setHours(hours);
                date.setMinutes(minutes);
                startTime = date.getTime();
            }
        }

        const sessionId = generateId();
        const newSession: GameSession = {
            id: sessionId,
            templateId: migratedTemplate.id,
            // [Identity Upgrade] Copy identity from template to session
            name: migratedTemplate.name,
            bggId: migratedTemplate.bggId,

            startTime: startTime,
            lastUpdatedAt: Date.now(),
            players: players,
            status: 'active',
            scoringRule: scoringRule,
            cloudFolderId: undefined,
            photos: [],
            location: options?.location || '',
            locationId: options?.locationId,
            note: ''
        };

        // [Refactor] Delegate Auto-Fill Logic to specialized initializer
        // Now passing the full template to handle texture mode logic
        newSession.players = await applyRecommendationsToPlayers(newSession, migratedTemplate);
        if (!isCurrent()) return null;
        
        // [New] Initial Winner Calculation
        newSession.winnerIds = calculateWinners(newSession.players, newSession.scoringRule);

        isImageDirtyRef.current = false;

        let loadedImageUrl: string | null = null;
        if (migratedTemplate.imageId) {
            const localImg = await imageService.getImage(migratedTemplate.imageId);
            if (!isCurrent()) return null;
            if (localImg) {
                loadedImageUrl = URL.createObjectURL(localImg.blob);
            }
        }

        setSessionImage(loadedImageUrl);
        setActiveTemplate(migratedTemplate);
        setCurrentSession(newSession);

        return sessionId;
    };

    const activateSession = async (session: GameSession, isCurrent: () => boolean): Promise<boolean> => {
        try {
            const loaded = await loadSessionActivation(session, getTemplate, isCurrent);
            if (!loaded) return false;
            if (!isCurrent()) {
                if (loaded.imageUrl) URL.revokeObjectURL(loaded.imageUrl);
                return false;
            }

            // Resume is a read, not an edit. Another owner (multiplayer) may
            // already be persisting newer snapshots of this same session.
            // Keep compatibility migrations in memory until an edit or save.
            cancelPendingAutosave();
            persistedSessionRef.current = loaded.session;
            setSessionImage(loaded.imageUrl);
            setActiveTemplate(loaded.template);
            setCurrentSession(loaded.session);
            return true;

        } catch (e) { console.error("Failed to resume session", e); }
        return false;
    };

    const resumeSession = async (templateId: string, shouldActivate?: () => boolean): Promise<boolean> => {
        if (shouldActivate?.() === false) return false;
        const isCurrent = beginActivation(shouldActivate);
        if (!isCurrent()) return false;
        const session = await db.sessions.where('templateId').equals(templateId).and(s => s.status === 'active').first();
        return session && isCurrent() ? activateSession(session, isCurrent) : false;
    };

    const resumeSessionById = async (sessionId: string, shouldActivate?: () => boolean): Promise<boolean> => {
        if (shouldActivate?.() === false) return false;
        const isCurrent = beginActivation(shouldActivate);
        if (!isCurrent()) return false;
        const session = await db.sessions.get(sessionId);
        if (!session || session.status !== 'active' || !isCurrent()) return false;
        return activateSession(session, isCurrent);
    };

    const discardSessionById = async (sessionId: string) => {
        activationRef.current.version += 1;
        const session = (currentSession?.id === sessionId ? currentSession : undefined)
            ?? await db.sessions.get(sessionId);

        if (!session) {
            if (currentSession?.id === sessionId) {
                setCurrentSession(null);
                setActiveTemplate(null);
            }
            return;
        }

        if (currentSession?.id === session.id) {
            cancelPendingAutosave();
            await waitForPendingAutosave();
        }
        await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
        await deleteSessionRecord(session.id);
        await cleanupService.cleanupDisposableTemplate(session.templateId, pinnedIds);

        if (currentSession?.id === session.id) {
            setCurrentSession(null);
            setActiveTemplate(null);
        }
    };

    const discardSession = async (templateId: string) => {
        activationRef.current.version += 1;
        const session = (currentSession?.templateId === templateId ? currentSession : undefined)
            ?? activeSessions?.find(s => s.templateId === templateId)
            ?? await db.sessions.where('templateId').equals(templateId).and(s => s.status === 'active').first();

        if (session) await discardSessionById(session.id);
    };

    const clearAllActiveSessions = async () => {
        activationRef.current.version += 1;
        const activeIds = activeSessions?.map(s => s.id) || [];
        if (activeIds.length > 0 && activeSessions) {
            if (currentSession && activeIds.includes(currentSession.id)) {
                cancelPendingAutosave();
                await waitForPendingAutosave();
            }
            for (const session of activeSessions) {
                await cleanupService.cleanSessionArtifacts(session.id, session.cloudFolderId);
            }
            await deleteSessionRecords(activeIds);
            if (currentSession && activeIds.includes(currentSession.id)) {
                setCurrentSession(null);
                setActiveTemplate(null);
            }
        }
    };

    const updateSession = (updatedSession: GameSession, options?: SessionUpdateOptions) => {
        const scoringTemplate = options?.template ?? activeTemplate;
        if (options?.template) {
            setActiveTemplate(options.template);
            if (activeTemplate?.imageId !== options.template.imageId) setSessionImage(null);
        }
        if (options?.alreadyPersisted) {
            cancelPendingAutosave();
            persistedSessionRef.current = updatedSession;
            setCurrentSession(updatedSession);
            return;
        }
        persistedSessionRef.current = null;
        const sessionWithTimestamp = { ...updatedSession, lastUpdatedAt: Date.now() };

        if (scoringTemplate) {
            setCurrentSession(calculateScoreSession(sessionWithTimestamp, scoringTemplate));
        } else {
            setCurrentSession(sessionWithTimestamp);
        }
    };

    const resetSessionScores = () => {
        if (!currentSession) return;
        const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0, bonusScore: 0 }));
        
        // [New] Recalculate winners after reset
        const winnerIds = calculateWinners(resetPlayers, currentSession.scoringRule);
        
        setCurrentSession({ 
            ...currentSession, 
            players: resetPlayers, 
            winnerIds: winnerIds,
            startTime: Date.now(), 
            lastUpdatedAt: Date.now() 
        });
    };

    const exitSession = async (overrides?: Partial<GameSession>) => {
        activationRef.current.version += 1;
        if (!currentSession) return;

        const sessionToSave = { ...currentSession, ...overrides };
        cancelPendingAutosave();
        await waitForPendingAutosave();

        const hasScores = sessionToSave.players.some(p =>
            Object.keys(p.scores).length > 0 ||
            (p.bonusScore || 0) !== 0 ||
            p.tieBreaker ||
            p.isForceLost ||
            p.isStarter
        );

        const hasCustomPlayers = sessionToSave.players.some(p => {
            if (p.linkedPlayerId) return true;
            const isSystemId = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
            return !isSystemId;
        });

        const hasPhotos = (sessionToSave.photos && sessionToSave.photos.length > 0);
        const hasLocation = !!sessionToSave.location;
        const hasNote = !!sessionToSave.note && sessionToSave.note.trim().length > 0;

        const hasDataToSave = hasScores || hasPhotos || hasCustomPlayers || hasLocation || hasNote;

        if (!hasDataToSave) {
            await cleanupService.cleanSessionArtifacts(sessionToSave.id, sessionToSave.cloudFolderId);
            await deleteSessionRecord(sessionToSave.id);

            if (activeTemplate) {
                await cleanupService.cleanupDisposableTemplate(activeTemplate.id, pinnedIds);
            }
        } else {
            const finalSession = { ...sessionToSave, lastUpdatedAt: Date.now() };
            await db.sessions.put(finalSession);

            if (isCloudEnabled()) {
                const folderName = finalSession.name || activeTemplate?.name || "Unknown Game";
                backupActiveSessionToCloud(finalSession, folderName).catch(e => console.warn("Background session backup failed", e));
            }
        }

        const isPureBuiltin = !!(await db.builtins.get(activeTemplate!.id)) && !activeTemplate!.sourceTemplateId;

        if (activeTemplate && !isPureBuiltin && isCloudEnabled() && isImageDirtyRef.current && !isDisposableTemplate(activeTemplate, pinnedIds)) {
            googleDriveService.backupTemplate(activeTemplate).then((updated) => {
                if (updated) {
                    db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
                }
            }).catch(console.error);
        }

        setCurrentSession(null);
        setActiveTemplate(null);
        setSessionImage(null);
        isImageDirtyRef.current = false;
    };

    const saveToHistory = async (finalLocation?: string) => {
        activationRef.current.version += 1;
        if (!currentSession || !activeTemplate) return;
        try {
            cancelPendingAutosave();
            await waitForPendingAutosave();
            const effectiveLocation = finalLocation !== undefined ? finalLocation : currentSession.location;
            const trimmedLoc = effectiveLocation?.trim();

            const rule = currentSession.scoringRule || 'HIGHEST_WINS';

            const winnerIds = calculateWinners(currentSession.players, rule);

            const snapshotTemplate = isDisposableTemplate(activeTemplate, pinnedIds)
                ? undefined
                : JSON.parse(JSON.stringify(activeTemplate));

            const now = Date.now();
            const record: HistoryRecord = {
                id: currentSession.id,
                templateId: activeTemplate.id,

                gameName: currentSession.name || activeTemplate.name,
                bggId: currentSession.bggId || activeTemplate.bggId,

                startTime: currentSession.startTime,
                endTime: now,
                updatedAt: now,
                players: currentSession.players,
                winnerIds: winnerIds,
                snapshotTemplate: snapshotTemplate as any,
                location: trimmedLoc,
                locationId: currentSession.locationId,
                note: currentSession.note || '',
                photos: currentSession.photos || [],
                photoContentIds: currentSession.photoContentIds,
                photoCloudIds: currentSession.photoCloudIds,
                cloudFolderId: currentSession.cloudFolderId,
                scoringRule: rule
            };

            await db.transaction('rw', db.history, db.sessions, async () => {
                await db.history.put(record);
                await db.sessions.delete(currentSession.id);
            });
            notifySessionDeleted(currentSession.id);

            try {
                await relationshipService.processGameEnd(record);
            } catch (relError) {
                console.warn("[SessionManager] Relationship processing failed:", relError);
            }

            if (isCloudEnabled()) {
                backupHistoryRecordToCloud(record, { moveFromActive: true }).catch(e => console.warn("Background history backup failed", e));
            }

            if (activeTemplate) {
                await cleanupService.cleanupDisposableTemplate(activeTemplate.id, pinnedIds);
            }

            setCurrentSession(null);
            setActiveTemplate(null);
            setSessionImage(null);
            isImageDirtyRef.current = false;

            showToast({ message: t('msg_session_saved'), type: 'success' });

        } catch (error) {
            console.error("Save to history failed:", error);
            showToast({ message: t('msg_session_save_failed'), type: 'error' });
        }
    };

    const updateActiveTemplate = async (updatedTemplate: GameTemplate) => {
        const oldTemplate = activeTemplate;
        const finalTemplate = await prepareTemplateForSave(
            { ...updatedTemplate, updatedAt: Date.now() },
            async (id) => !!(await db.builtins.get(id))
        );

        await db.templates.put(finalTemplate);
        let sessionWithSync: GameSession | null = null;
        if (currentSession) {
            sessionWithSync = applyTemplateToSession(currentSession, oldTemplate, finalTemplate);

            setCurrentSession(sessionWithSync);
        }

        setActiveTemplate(finalTemplate);

        if (isCloudEnabled() && !isDisposableTemplate(finalTemplate, pinnedIds)) {
            googleDriveService.backupTemplate(finalTemplate).then((updated) => {
                if (updated) {
                    db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
                }
            }).catch(console.error);
        }

        return { template: finalTemplate, session: sessionWithSync };
    };

    const handleUpdateSessionImage = async (imgBlobOrUrl: string | Blob | null) => {
        if (!activeTemplate || !imgBlobOrUrl) {
            if (activeTemplate?.imageId) {
                await imageService.deleteImage(activeTemplate.imageId);
                const updatedT = { ...activeTemplate, imageId: undefined, hasImage: false, cloudImageId: undefined };
                updateActiveTemplate(updatedT);
            }
            setSessionImage(null);
            return;
        }

        let blob: Blob;
        if (typeof imgBlobOrUrl === 'string') {
            blob = imageService.base64ToBlob(imgBlobOrUrl);
        } else {
            blob = imgBlobOrUrl;
        }

        if (activeTemplate.imageId) {
            try {
                await imageService.deleteImage(activeTemplate.imageId);
            } catch (e) {
                console.warn("Failed to delete old template image", e);
            }
        }

        isImageDirtyRef.current = true;
        const savedImg = await imageService.saveImage(blob, activeTemplate.id, 'template');

        if (sessionImage) URL.revokeObjectURL(sessionImage);
        setSessionImage(URL.createObjectURL(blob));

        const updatedT = { ...activeTemplate, imageId: savedImg.id, hasImage: true, cloudImageId: undefined };
        updateActiveTemplate(updatedT);
    };

    return {
        currentSession,
        activeTemplate,
        sessionImage,
        sessionPlayerCount,
        startSession,
        resumeSession,
        resumeSessionById,
        discardSession,
        discardSessionById,
        clearAllActiveSessions,
        updateSession,
        resetSessionScores,
        exitSession,
        saveToHistory,
        updateActiveTemplate,
        setSessionImage: handleUpdateSessionImage,
        updateSavedPlayer: updatePlayer
    };
};

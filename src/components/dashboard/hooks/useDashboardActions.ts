
import React, { useState } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { generateId } from '../../../utils/idGenerator';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { GameOption } from '../../../features/game-selector/types';
import { buildBuiltinShareUrl, toBuiltinShortId } from '../../../utils/deepLink';
import { useConfirm } from '../../../hooks/useConfirm';
import { useCommonTranslation } from '../../../i18n/common';

interface UseDashboardActionsProps {
    isAutoConnectEnabled: boolean;
    onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
    onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean, preserveTimestamps?: boolean }) => void;
    onImportHistory: (record: HistoryRecord) => void;
    onImportSession: (session: GameSession) => void;
    onImportSettings?: (settings: any) => void;
    onGetLocalData: () => Promise<any>;
    onTogglePin: (id: string) => void;
    onTogglePinOption: (option: GameOption) => void;
    onDeleteHistory: (id: string) => void;
    onClearAllActiveSessions: () => void;
    onRestoreSystem: (id: string) => void;
    onTemplateDelete: (id: string) => void;
    onDiscardSession: (id: string) => void;
}

export const useDashboardActions = ({
    isAutoConnectEnabled,
    onGetFullTemplate,
    onTemplateSave,
    onImportHistory,
    onImportSession,
    onImportSettings,
    onGetLocalData,
    onTogglePin,
    onTogglePinOption,
    onDeleteHistory,
    onClearAllActiveSessions,
    onRestoreSystem,
    onTemplateDelete,
    onDiscardSession
}: UseDashboardActionsProps) => {
    const { t } = useDashboardTranslation();
    const { t: tCommon } = useCommonTranslation();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const { handleBackup, performFullBackup, performFullRestore } = useGoogleDrive();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [sharingTemplate, setSharingTemplate] = useState<GameTemplate | null>(null);

    // Action: Copy JSON (Local UI Copy, no upload)
    const handleCopyJSON = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        let templateToCopy = partialTemplate;
        if (!partialTemplate.columns || partialTemplate.columns.length === 0) {
            const full = await onGetFullTemplate(partialTemplate.id);
            if (full) templateToCopy = full;
        }
        const json = JSON.stringify(templateToCopy, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            setCopiedId(partialTemplate.id);
            setTimeout(() => setCopiedId(null), 2000);
            showToast({ message: t('msg_json_copied'), type: 'success' });
        });
    };

    // Action: Google Drive Backup (Only if user initiated orange button)
    const handleCloudBackup = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isAutoConnectEnabled) {
            showToast({ message: t('msg_cloud_connect_first'), type: 'warning' });
            return;
        }
        const full = await onGetFullTemplate(partialTemplate.id);
        if (full) {
            const updated = await handleBackup(full);
            if (updated) {
                onTemplateSave({ ...updated, lastSyncedAt: Date.now() }, { skipCloud: true, preserveTimestamps: true });
            }
        }
    };

    // Action: Open the Modal
    const handleCopyTemplateShareLink = (template: GameTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Just set the state to open modal. NO OTHER LOGIC.
        setSharingTemplate(template);
    };

    // Action: Built-in link copy
    const handleCopyBuiltinShareLink = (template: GameTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const sourceId = template.sourceTemplateId || template.id;
        const shortId = toBuiltinShortId(sourceId);
        const link = buildBuiltinShareUrl(shortId);

        navigator.clipboard.writeText(link).then(() => {
            setCopiedId(template.id);
            setTimeout(() => setCopiedId(null), 2000);
            showToast({ message: t('msg_share_link_copied'), type: 'success' });
        });
    };

    // Action: Copy system template
    const handleCopySystemTemplate = async (source: GameTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const full = await onGetFullTemplate(source.id);
        if (full) {
            const newT = { ...full, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
            onTemplateSave(newT, { skipCloud: true });
            showToast({ message: t('msg_copy_created'), type: 'success' });
        }
    };

    // --- Wrapped Confirmation Actions ---

    const handleDeleteTemplateConfirmed = async (id: string) => {
        if (await confirm({
            title: t('confirm_delete_template_title'),
            message: t('confirm_delete_template_msg'),
            confirmText: tCommon('delete'),
            isDangerous: true
        })) {
            onTemplateDelete(id);
        }
    };

    const handleDiscardSessionConfirmed = async (id: string) => {
        if (await confirm({
            title: t('confirm_delete_session_title'),
            message: t('confirm_delete_session_msg'),
            confirmText: tCommon('delete'),
            isDangerous: true
        })) {
            onDiscardSession(id);
        }
    };

    const handleDeleteHistoryConfirmed = async (id: string) => {
        if (await confirm({
            title: t('confirm_delete_history_title'),
            message: t('confirm_delete_template_msg'),
            confirmText: tCommon('delete'),
            isDangerous: true
        })) {
            onDeleteHistory(id);
        }
    };

    const handleClearAllSessionsConfirmed = async () => {
        if (await confirm({
            title: t('confirm_clear_all_sessions_title'),
            message: t('confirm_clear_all_sessions_msg'),
            confirmText: t('confirm_clear_all'),
            isDangerous: true
        })) {
            onClearAllActiveSessions();
        }
    };

    const handleRestoreSystemConfirmed = async (template: GameTemplate) => {
        if (await confirm({
            title: t('confirm_restore_title'),
            message: t('confirm_restore_msg'),
            confirmText: tCommon('restore')
        })) {
            onRestoreSystem(template.id);
        }
    };

    return {
        copiedId,
        sharingTemplate,
        setSharingTemplate,
        handleCopyJSON,
        handleCopyTemplateShareLink,
        handleCopyBuiltinShareLink,
        handleCloudBackup,
        handleCopySystemTemplate,
        handleDeleteTemplateConfirmed,
        handleDiscardSessionConfirmed,
        handleDeleteHistoryConfirmed,
        handleClearAllSessionsConfirmed,
        handleRestoreSystemConfirmed,
        handleSystemBackupAction: (p: (c: number, t: number) => void, e: (f: string[]) => void) => performFullBackup(onGetLocalData, p, e),
        handleSystemRestoreAction: performFullRestore,
        handlePinGameOption: (opt: GameOption) => {
            onTogglePinOption(opt);
        },
    };
};

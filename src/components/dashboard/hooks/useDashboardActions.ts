
import React, { useState } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { generateId } from '../../../utils/idGenerator';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { GameOption } from '../../../features/game-selector/types';
import { buildBuiltinShareUrl, toBuiltinShortId } from '../../../utils/deepLink';

interface UseDashboardActionsProps {
    isAutoConnectEnabled: boolean;
    onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
    onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean, preserveTimestamps?: boolean }) => void;
    onImportHistory: (record: HistoryRecord) => void;
    onImportSession: (session: GameSession) => void;
    onImportSettings?: (settings: any) => void;
    onGetLocalData: () => Promise<any>;
    onTogglePin: (id: string) => void;
}

export const useDashboardActions = ({
    isAutoConnectEnabled,
    onGetFullTemplate,
    onTemplateSave,
    onImportHistory,
    onImportSession,
    onImportSettings,
    onGetLocalData,
    onTogglePin
}: UseDashboardActionsProps) => {
    const { t } = useDashboardTranslation();
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

    return {
        copiedId,
        sharingTemplate,
        setSharingTemplate,
        handleCopyJSON,
        handleCopyTemplateShareLink,
        handleCopyBuiltinShareLink,
        handleCloudBackup,
        handleCopySystemTemplate,
        handlePinGameOption: async (opt: GameOption) => {
            if (opt.templateId) {
                // [Case A] 已有 Template：直接 toggle pin
                onTogglePin(opt.templateId);
            } else {
                // [Case B] 簡易遊戲（無 Template）：比照 useGameLauncher 的 Case B，先建立拋棄式模板再釘選
                const newTemplate: GameTemplate = {
                    id: generateId(),
                    name: opt.cleanName || opt.displayName,
                    columns: [],
                    bggId: opt.bggId || '',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    defaultScoringRule: (opt.defaultScoringRule as any) || 'HIGHEST_WINS',
                    hasImage: false
                };
                await onTemplateSave(newTemplate, { skipCloud: true });
                onTogglePin(newTemplate.id);
            }
        },
        handleSystemBackupAction: async () => ({ success: 0, skipped: 0, failed: 0 }), // Mock
        handleSystemRestoreAction: async () => ({ success: 0, skipped: 0, failed: 0 })  // Mock
    };
};

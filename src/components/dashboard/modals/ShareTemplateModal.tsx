
import React, { useState, useEffect } from 'react';
import { X, Copy, Share, Loader2, Link as LinkIcon, Check, UploadCloud, FileCode, AlertCircle } from 'lucide-react';
import { GameTemplate } from '../../../types';
import { db } from '../../../db';
import { uploadTemplateToCloud, buildCloudShareUrl } from '../../../services/templateShareService';
import { useToast } from '../../../hooks/useToast';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useCommonTranslation } from '../../../i18n/common';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

interface ShareTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: GameTemplate;
    onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
}

const ShareTemplateModal: React.FC<ShareTemplateModalProps> = ({
    isOpen,
    onClose,
    template,
    onGetFullTemplate
}) => {
    const { t } = useDashboardTranslation();
    const { t: tCommon } = useCommonTranslation();
    const { showToast } = useToast();

    // [Migrated] 返回鍵關閉分享彈窗
    useModalBackHandler(isOpen, onClose, 'share-template');

    const [isLoading, setIsLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [isJsonCopied, setIsJsonCopied] = useState(false);

    // Initial state: Check for cache on open
    useEffect(() => {
        if (isOpen) {
            const checkCache = async () => {
                const currentUpdatedAt = template.updatedAt || template.createdAt || 0;
                const cached = await db.templateShareCache.get(template.id);

                if (cached && cached.templateUpdatedAt === currentUpdatedAt) {
                    // 優先取 BGG 英文名稱作為 Slug
                    let englishName = '';
                    if (template.bggId) {
                        const bgg = await db.bggGames.get(template.bggId);
                        if (bgg) englishName = bgg.name;
                    }
                    if (!englishName) englishName = template.name;

                    const link = buildCloudShareUrl(cached.cloudId, englishName);
                    setShareUrl(link);
                } else {
                    setShareUrl('');
                }
            };

            checkCache();
            setIsLoading(false);
            setIsCopied(false);
            setIsJsonCopied(false);
        }
    }, [isOpen, template.id, template.updatedAt, template.bggId, template.name]);

    const handleCopyJSON = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            let templateToShare = template;
            if (!template.columns || template.columns.length === 0) {
                const full = await onGetFullTemplate(template.id);
                if (full) templateToShare = full;
            }

            const {
                createdAt: _c, updatedAt: _u, lastSyncedAt: _s,
                imageId: _i, hasImage: _h, cloudImageId: _ci,
                ...sanitized
            } = templateToShare;

            await navigator.clipboard.writeText(JSON.stringify(sanitized, null, 2));
            setIsJsonCopied(true);
            showToast({ message: t('msg_json_copied'), type: 'success' });
            setTimeout(() => setIsJsonCopied(false), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUploadToCloud = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        setIsLoading(true);
        try {
            let templateToShare = template;
            if (!template.columns || template.columns.length === 0) {
                const full = await onGetFullTemplate(template.id);
                if (full) templateToShare = full;
            }

            // Validation: Prevent upload of unfinished templates
            const hasNoColumns = !templateToShare.columns || templateToShare.columns.length === 0;
            const hasDefaultNames = templateToShare.columns?.some(c => /^(項目|Item)\s*\d+$/i.test(c.name));

            if (hasNoColumns || hasDefaultNames) {
                showToast({ message: t('msg_cloud_share_unfinished'), type: 'error' });
                setIsLoading(false);
                return;
            }

            const currentUpdatedAt = templateToShare.updatedAt || templateToShare.createdAt || 0;
            const cached = await db.templateShareCache.get(templateToShare.id);

            let cloudId: string;
            if (cached && cached.templateUpdatedAt === currentUpdatedAt) {
                cloudId = cached.cloudId;
            } else {
                const uploaded = await uploadTemplateToCloud(templateToShare, (t as any).language);
                cloudId = uploaded.id;
                await db.templateShareCache.put({
                    templateId: templateToShare.id,
                    templateUpdatedAt: currentUpdatedAt,
                    cloudId
                });
            }

            // 優先取 BGG 英文名稱作為 Slug
            let englishName = '';
            if (templateToShare.bggId) {
                const bgg = await db.bggGames.get(templateToShare.bggId);
                if (bgg) englishName = bgg.name;
            }
            if (!englishName) englishName = templateToShare.name;

            const link = buildCloudShareUrl(cloudId, englishName);
            setShareUrl(link);
        } catch (error) {
            console.error('Cloud share failed:', error);
            // FAIL HERE BUT KEEP MODAL OPEN
            showToast({ message: t('msg_cloud_share_failed'), type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyLink = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setIsCopied(true);
            showToast({ message: t('share_modal_copy_success'), type: 'success' });
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNativeShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!shareUrl) return;
        try {
            await navigator.share({ title: template.name, url: shareUrl });
        } catch (err) {
            if ((err as Error).name !== 'AbortError') console.error('Native share failed', err);
        }
    };

    if (!isOpen) return null;

    const hasBgImage = template.hasImage || template.imageId;

    return (
        <div
            className="modal-backdrop z-[110] animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal-container p-6 animate-in zoom-in-95 duration-200"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="modal-title flex items-center gap-2">
                        <Share size={20} className="text-brand-primary" />
                        {t('share_modal_title')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-txt-muted hover:text-txt-primary hover:bg-surface-bg-alt rounded-full transition-colors focus:ring-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="text-sm text-txt-muted mb-6 truncate">{template.name}</div>

                {/* Local JSON Section */}
                <div className="space-y-3 mb-6">
                    <div className="text-xs font-bold text-txt-muted uppercase tracking-wider flex items-center gap-2">
                        <FileCode size={14} />
                        {t('share_modal_local_title')}
                    </div>
                    <div className="modal-bg-elevated rounded-xl p-4 border border-surface-border">
                        <p className="text-xs text-txt-muted mb-4">{t('share_modal_local_desc')}</p>
                        <button
                            onClick={handleCopyJSON}
                            className="w-full flex items-center justify-center gap-2 py-2.5 btn-modal-secondary rounded-lg font-bold transition-all shadow-sm"
                        >
                            {isJsonCopied ? <Check size={18} className="text-brand-primary" /> : <Copy size={18} />}
                            {tCommon('copy')} JSON
                        </button>
                    </div>
                </div>

                {/* Cloud Upload Section */}
                <div className="space-y-3">
                    <div className="text-xs font-bold text-txt-muted uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud size={14} />
                        {t('share_modal_cloud_title')}
                    </div>

                    <div className="modal-bg-elevated rounded-xl p-4 border border-brand-primary/20 space-y-4">
                        {!shareUrl && !isLoading && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-3 text-status-warning">
                                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                        <p className="text-xs leading-relaxed">{t('share_modal_cloud_warning')}</p>
                                    </div>
                                    <div className="flex gap-3 text-status-info">
                                        <Check size={16} className="shrink-0 mt-0.5" />
                                        <p className="text-xs leading-relaxed italic">{t('share_modal_recruitment')}</p>
                                    </div>
                                </div>
                                {hasBgImage && <p className="text-[10px] text-txt-muted italic pl-7">{t('share_modal_img_note')}</p>}
                                <button
                                    onClick={handleUploadToCloud}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary hover:filter hover:brightness-110 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all"
                                >
                                    <UploadCloud size={18} />
                                    {t('share_modal_cloud_btn')}
                                </button>
                            </>
                        )}

                        {isLoading && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Loader2 size={32} className="text-brand-primary animate-spin" />
                                <p className="text-sm text-txt-secondary">{t('share_modal_uploading')}</p>
                            </div>
                        )}

                        {shareUrl && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                <div className="modal-bg-recessed border border-surface-border rounded-lg p-3 flex items-center gap-2">
                                    <LinkIcon size={14} className="text-brand-primary shrink-0" />
                                    <input type="text" readOnly value={shareUrl} className="bg-transparent text-xs text-txt-secondary flex-1 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopyLink} className="flex items-center justify-center gap-2 py-3 bg-brand-primary hover:filter hover:brightness-110 text-white rounded-xl font-bold active:scale-95 transition-all">
                                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                        {tCommon('copy')}
                                    </button>
                                    <button onClick={handleNativeShare} className="btn-modal-secondary flex items-center justify-center gap-2 py-3 rounded-xl font-bold active:scale-95 shadow-sm">
                                        <Share size={18} className="text-status-info" />
                                        {tCommon('share')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareTemplateModal;

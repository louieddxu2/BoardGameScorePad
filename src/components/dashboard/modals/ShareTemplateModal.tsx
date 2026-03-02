
import React, { useState, useEffect } from 'react';
import { X, Copy, Share, Loader2, Link as LinkIcon, Check, UploadCloud, FileCode, AlertCircle } from 'lucide-react';
import { GameTemplate } from '../../../types';
import { db } from '../../../db';
import { uploadTemplateToCloud, buildCloudShareUrl } from '../../../services/templateShareService';
import { useToast } from '../../../hooks/useToast';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useCommonTranslation } from '../../../i18n/common';

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

            const currentUpdatedAt = templateToShare.updatedAt || templateToShare.createdAt || 0;
            const cached = await db.templateShareCache.get(templateToShare.id);

            let cloudId: string;
            if (cached && cached.templateUpdatedAt === currentUpdatedAt) {
                cloudId = cached.cloudId;
            } else {
                const uploaded = await uploadTemplateToCloud(templateToShare);
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
            className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 p-6 relative animate-in zoom-in-95 duration-200 flex flex-col gap-6"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Share size={20} className="text-emerald-500" />
                        {t('share_modal_title')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors focus:ring-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="text-sm text-slate-400 -mt-2 truncate">{template.name}</div>

                {/* Local JSON Section */}
                <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <FileCode size={14} />
                        {t('share_modal_local_title')}
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800">
                        <p className="text-xs text-slate-400 mb-4">{t('share_modal_local_desc')}</p>
                        <button
                            onClick={handleCopyJSON}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition-all"
                        >
                            {isJsonCopied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                            {tCommon('copy')} JSON
                        </button>
                    </div>
                </div>

                {/* Cloud Upload Section */}
                <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud size={14} />
                        {t('share_modal_cloud_title')}
                    </div>

                    <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20 space-y-4">
                        {!shareUrl && !isLoading && (
                            <>
                                <div className="flex gap-3 text-amber-500/80">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <p className="text-xs leading-relaxed">{t('share_modal_cloud_warning')}</p>
                                </div>
                                {hasBgImage && <p className="text-[10px] text-slate-500 italic pl-7">{t('share_modal_img_note')}</p>}
                                <button
                                    onClick={handleUploadToCloud}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg active:scale-95"
                                >
                                    <UploadCloud size={18} />
                                    {t('share_modal_cloud_btn')}
                                </button>
                            </>
                        )}

                        {isLoading && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Loader2 size={32} className="text-emerald-500 animate-spin" />
                                <p className="text-sm text-slate-400">{t('share_modal_uploading')}</p>
                            </div>
                        )}

                        {shareUrl && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                <div className="bg-black/40 border border-slate-800 rounded-lg p-3 flex items-center gap-2">
                                    <LinkIcon size={14} className="text-emerald-500 shrink-0" />
                                    <input type="text" readOnly value={shareUrl} className="bg-transparent text-xs text-slate-300 flex-1 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopyLink} className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold active:scale-95">
                                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                        {tCommon('copy')}
                                    </button>
                                    <button onClick={handleNativeShare} className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold active:scale-95">
                                        <Share size={18} className="text-sky-400" />
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


import React, { useState, useEffect } from 'react';
import { X, Copy, Share, Loader2, Link as LinkIcon, Check } from 'lucide-react';
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

    useEffect(() => {
        if (isOpen && template) {
            prepareShareLink();
        } else {
            // Reset state when closing
            setShareUrl('');
            setIsLoading(false);
            setIsCopied(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, template.id]);

    const prepareShareLink = async () => {
        setIsLoading(true);
        try {
            let templateToShare = template;
            if (!template.columns || template.columns.length === 0) {
                const full = await onGetFullTemplate(template.id);
                if (full) {
                    templateToShare = full;
                } else {
                    showToast({ message: t('msg_read_template_failed'), type: 'error' });
                    onClose();
                    return;
                }
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

            const link = buildCloudShareUrl(cloudId);
            setShareUrl(link);
        } catch (error) {
            console.error('Cloud share failed:', error);
            showToast({ message: t('msg_cloud_share_failed'), type: 'error' });
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setIsCopied(true);
            showToast({ message: t('share_modal_copy_success'), type: 'success' });
            setTimeout(() => setIsCopied(null as any), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNativeShare = async () => {
        if (!shareUrl) return;
        try {
            await navigator.share({
                title: template.name,
                url: shareUrl
            });
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Native share failed', err);
            }
        }
    };

    // Close on Back Button
    useEffect(() => {
        if (!isOpen) return;
        const handlePopState = () => onClose();
        window.history.pushState({ modal: 'share' }, '');
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            // If the user closed via X or backdrop, we might want to pop state if it hasn't been popped
            if (window.history.state?.modal === 'share') {
                window.history.back();
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 p-6 relative animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center gap-4 py-2">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-2">
                        <LinkIcon size={28} />
                    </div>

                    <h3 className="text-xl font-bold text-white leading-tight">
                        {t('share_modal_title')}
                        <div className="text-sm font-normal text-slate-400 mt-1">{template.name}</div>
                    </h3>

                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <Loader2 size={32} className="text-emerald-500 animate-spin" />
                            <p className="text-sm text-slate-400 animate-pulse">{t('share_modal_loading')}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-400">
                                {t('share_modal_desc')}
                            </p>

                            <div className="w-full mt-2">
                                <div className="bg-black/40 border border-slate-800 rounded-lg p-3 flex items-center gap-2 mb-6">
                                    <input
                                        type="text"
                                        readOnly
                                        value={shareUrl}
                                        className="bg-transparent text-xs text-slate-300 flex-1 outline-none truncate"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                                    >
                                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                        {tCommon('copy')}
                                    </button>

                                    <button
                                        onClick={handleNativeShare}
                                        className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all active:scale-95"
                                    >
                                        <Share size={18} className="text-sky-400" />
                                        {tCommon('share')}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareTemplateModal;

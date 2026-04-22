
import React, { useState, useEffect } from 'react';
import { Search, X, Image as ImageIcon, HardDrive, Clock } from 'lucide-react';
import { db } from '../../../../db';
import { LocalImage } from '../../../../types';
import { formatBytes } from '../../../../utils/formatUtils';
import { useInspectorTranslation } from '../shared/InspectorCommon';
import { useImageSource } from '../hooks/useImageSource';

const ImageInspector = () => {
    const t = useInspectorTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState<LocalImage | null>(null);

    const images = useImageSource(searchTerm);

    // Load full image blob only for the SINGLE selected item
    useEffect(() => {
        if (selectedId) {
            db.images.get(selectedId).then(img => {
                if (img) {
                    setSelectedImage(img);
                    const url = URL.createObjectURL(img.blob);
                    setPreviewUrl(url);
                }
            });
        } else {
            setSelectedImage(null);
            setPreviewUrl(null);
        }

        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const displayImages = images || [];

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left: Image List */}
            <div className="w-1/3 border-r border-surface-border overflow-y-auto no-scrollbar modal-bg-recessed/30">
                <div className="p-3 sticky top-0 modal-bg-elevated border-b border-surface-border z-10 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-txt-muted flex items-center gap-1">
                            <ImageIcon size={12} /> {t('list_images')} ({t('list_display_prefix')}{displayImages.length}{t('list_display_suffix')})
                        </span>
                    </div>
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('input_search_id_placeholder')}
                            className="w-full modal-bg-recessed border border-surface-border rounded-lg pl-7 pr-6 py-1 text-xs text-txt-primary focus:border-brand-primary outline-none transition-colors"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary p-1">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-2 space-y-1">
                    {displayImages.map((img: LocalImage & { sourceName?: string }) => (
                        <button
                            key={img.id}
                            onClick={() => setSelectedId(img.id)}
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex flex-col gap-1 active:scale-[0.98] ${selectedId === img.id ? 'bg-brand-primary text-white shadow-md' : 'modal-bg-elevated text-txt-secondary border border-surface-border/50 hover:modal-bg-recessed hover:text-txt-primary'}`}
                        >
                            <div className="flex justify-between w-full">
                                <span className={`font-mono truncate w-24 text-[10px] ${selectedId === img.id ? 'text-white/60' : 'text-txt-muted'}`}>{img.id.substring(0, 8)}...</span>
                                <span className={`text-[9px] font-bold ${selectedId === img.id ? 'text-white/80' : 'text-txt-muted'}`}>
                                    {img.createdAt ? new Date(img.createdAt).toLocaleDateString() : img.relatedType}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80 min-w-0">
                                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${img.relatedType === 'template' ? 'bg-status-info' : 'bg-status-warning'}`} />
                                <span className="font-bold truncate">{img.sourceName || img.relatedId}</span>
                            </div>
                            {img.createdAt && (
                                <div className={`text-[9px] flex items-center gap-1 ${selectedId === img.id ? 'text-white/50' : 'text-txt-muted/70'}`}>
                                    <Clock size={8} />
                                    {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </button>
                    ))}
                    {displayImages.length === 0 && (
                        <div className="text-center py-8 text-xs text-txt-muted italic">
                            {t('no_data_category')}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Preview */}
            <div className="flex-1 bg-app-bg p-4 flex flex-col items-center justify-center overflow-hidden">
                {selectedImage ? (
                    <div className="flex flex-col items-center gap-4 w-full h-full animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="relative flex-1 w-full min-h-0 rounded-xl overflow-hidden border border-surface-border bg-black/20 flex items-center justify-center shadow-inner">
                            {previewUrl && <img src={previewUrl} className="max-w-full max-h-full object-contain drop-shadow-2xl" alt="Preview" />}
                        </div>
                        <div className="w-full modal-bg-elevated p-4 rounded-xl border border-surface-border grid grid-cols-2 gap-4 text-xs shadow-lg">
                            <div>
                                <span className="text-txt-muted block mb-1">{t('img_id')}</span>
                                <span className="text-txt-primary font-mono break-all">{selectedImage.id}</span>
                            </div>
                            <div>
                                <span className="text-txt-muted block mb-1">{t('img_size')}</span>
                                <span className="text-status-success font-bold">{formatBytes(selectedImage.blob.size)}</span>
                            </div>
                            <div>
                                <span className="text-txt-muted block mb-1">{t('img_related_id')}</span>
                                <span className="text-brand-secondary font-mono break-all">{selectedImage.relatedId}</span>
                            </div>
                            <div>
                                <span className="text-txt-muted block mb-1">{t('last_used')}</span>
                                <span className="text-txt-primary">{selectedImage.createdAt ? new Date(selectedImage.createdAt).toLocaleString() : '-'}</span>
                            </div>
                            <div>
                                <span className="text-txt-muted block mb-1">{t('img_type')}</span>
                                <span className="text-txt-primary capitalize">{selectedImage.relatedType}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-txt-muted flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full modal-bg-recessed flex items-center justify-center border-2 border-surface-border border-dashed">
                            <ImageIcon size={32} className="opacity-20" />
                        </div>
                        <span className="text-sm font-medium">{t('select_hint')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageInspector;


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
            <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
                <div className="p-3 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 backdrop-blur-sm bg-opacity-95">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <ImageIcon size={12} /> {t('list_images')} ({t('list_display_prefix')}{displayImages.length}{t('list_display_suffix')})
                        </span>
                    </div>
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('input_search_id_placeholder')}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-6 py-1 text-xs text-white focus:border-emerald-500 outline-none"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1">
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
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex flex-col gap-1 ${selectedId === img.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <div className="flex justify-between w-full">
                                <span className="font-mono truncate w-24 text-[10px] opacity-70">{img.id.substring(0, 8)}...</span>
                                <span className="text-[9px] font-bold text-slate-400">
                                    {img.createdAt ? new Date(img.createdAt).toLocaleDateString() : img.relatedType}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80 min-w-0">
                                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${img.relatedType === 'template' ? 'bg-sky-400' : 'bg-yellow-400'}`} />
                                <span className="font-bold truncate">{img.sourceName || img.relatedId}</span>
                            </div>
                            {img.createdAt && (
                                <div className="text-[9px] opacity-50 flex items-center gap-1">
                                    <Clock size={8} />
                                    {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </button>
                    ))}
                    {displayImages.length === 0 && (
                        <div className="text-center py-8 text-xs text-slate-600 italic">
                            {t('no_data_category')}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Preview */}
            <div className="flex-1 bg-slate-950 p-4 flex flex-col items-center justify-center overflow-hidden">
                {selectedImage ? (
                    <div className="flex flex-col items-center gap-4 w-full h-full">
                        <div className="relative flex-1 w-full min-h-0 rounded-xl overflow-hidden border border-slate-800 bg-black/50 flex items-center justify-center">
                            {previewUrl && <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Preview" />}
                        </div>
                        <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block mb-1">{t('img_id')}</span>
                                <span className="text-white font-mono break-all">{selectedImage.id}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">{t('img_size')}</span>
                                <span className="text-emerald-400 font-bold">{formatBytes(selectedImage.blob.size)}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">{t('img_related_id')}</span>
                                <span className="text-indigo-300 font-mono break-all">{selectedImage.relatedId}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">{t('last_used')}</span>
                                <span className="text-white">{selectedImage.createdAt ? new Date(selectedImage.createdAt).toLocaleString() : '-'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">{t('img_type')}</span>
                                <span className="text-white capitalize">{selectedImage.relatedType}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-3">
                        <HardDrive size={48} className="opacity-20" />
                        <span>{t('select_hint')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageInspector;

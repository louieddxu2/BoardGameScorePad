
import React from 'react';
import { X, ScanLine, DownloadCloud, Aperture, Upload, Trash2 } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface SessionBackgroundModalProps {
    isOpen: boolean;
    onClose: () => void;
    hasCloudImage: boolean;
    isConnected: boolean;
    onCloudDownload: () => void;
    onScannerCamera: () => void;
    onUploadClick: () => void; // Trigger hidden input
    onRemoveBackground: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SessionBackgroundModal: React.FC<SessionBackgroundModalProps> = ({
    isOpen,
    onClose,
    hasCloudImage,
    isConnected,
    onCloudDownload,
    onScannerCamera,
    onUploadClick,
    onRemoveBackground,
    fileInputRef,
    onFileChange
}) => {
    const { t } = useSessionTranslation();
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            onClick={onClose}
        >
            <div
                className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                    <ScanLine size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('bg_modal_title')}</h3>
                <p className="text-sm text-slate-400">
                    {t('bg_modal_msg_has_visuals')}
                    {hasCloudImage ? t('bg_modal_cloud_hint') : t('bg_modal_local_hint')}
                </p>

                {hasCloudImage && (
                    <button
                        onClick={onCloudDownload}
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
                    >
                        <DownloadCloud size={20} />
                        {isConnected ? t('bg_btn_cloud_download') : t('bg_btn_cloud_connect')}
                    </button>
                )}

                <button onClick={onScannerCamera} className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${hasCloudImage ? 'mt-1' : 'mt-2'}`}>
                    <Aperture size={20} /> {t('bg_btn_camera')}
                </button>

                <button onClick={onUploadClick} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2">
                    <Upload size={20} /> {t('bg_btn_upload')}
                </button>
                {/* The actual input remains here but controlled via ref from parent or local handle */}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

                <button onClick={onRemoveBackground} className="flex items-center gap-2 text-slate-500 text-xs hover:text-red-400 mt-4 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <Trash2 size={14} /> {t('bg_btn_remove')}
                </button>
            </div>
        </div>
    );
};

export default SessionBackgroundModal;

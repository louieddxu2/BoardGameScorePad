
import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { useToolsTranslation } from '../../i18n/tools';

interface MediaToolProps {
    onTakePhoto?: () => void;
    onScreenshot?: () => void;
}

const MediaTool: React.FC<MediaToolProps> = ({ onTakePhoto, onScreenshot }) => {
    const { t } = useToolsTranslation();
    return (
        <div className="grid grid-cols-2 gap-3 h-full">
            <button
                onClick={onTakePhoto}
                className="flex flex-col items-center justify-center p-3 bg-[rgb(var(--c-input-header-bg))] hover:bg-surface-hover rounded-2xl border border-[rgb(var(--c-input-border))] transition-all active:scale-95 text-txt-primary h-24 shadow-sm"
            >
                <div className="p-2 bg-sky-500/10 rounded-full mb-1 text-sky-500">
                    <Camera size={24} />
                </div>
                <span className="text-xs font-bold">{t('media_camera')}</span>
            </button>
            <button
                onClick={onScreenshot}
                className="flex flex-col items-center justify-center p-3 bg-[rgb(var(--c-input-header-bg))] hover:bg-surface-hover rounded-2xl border border-[rgb(var(--c-input-border))] transition-all active:scale-95 text-txt-primary h-24 shadow-sm"
            >
                <div className="p-2 bg-status-success/10 rounded-full mb-1 text-status-success">
                    <ImageIcon size={24} />
                </div>
                <span className="text-xs font-bold">{t('media_screenshot')}</span>
            </button>
        </div>
    );
};

export default MediaTool;

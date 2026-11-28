
import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { useToolsTranslation } from '../../i18n/tools';

interface MediaToolProps {
    onTakePhoto?: () => void;
    onScreenshot?: () => void;
    onShowScores?: () => void;
}

function ScoreDisplayIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="3" />
            <path d="M3 12h18M7 9V7m3 2V7m4 10v-2m3 2v-2" />
        </svg>
    );
}

const MediaTool: React.FC<MediaToolProps> = ({ onTakePhoto, onScreenshot, onShowScores }) => {
    const { t } = useToolsTranslation();
    const camera = { label: t('media_camera'), onClick: onTakePhoto, Icon: Camera, color: 'bg-brand-secondary/10 text-brand-secondary' };
    const screenshot = { label: t('media_screenshot'), onClick: onScreenshot, Icon: ImageIcon, color: 'bg-status-success/10 text-status-success' };
    const display = { label: t('media_display'), onClick: onShowScores, Icon: ScoreDisplayIcon, color: 'bg-status-info/10 text-status-info' };
    const tools = onShowScores ? [screenshot, camera, display] : [camera, screenshot];

    return (
        <div className={`grid ${onShowScores ? 'grid-cols-3' : 'grid-cols-2'} gap-3 h-full`}>
            {tools.map(({ label, onClick, Icon, color }) => (
                <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex flex-col items-center justify-center p-2 bg-surface-alt hover:bg-surface-hover rounded-2xl border border-surface-border transition-all active:scale-95 text-txt-primary h-24 shadow-sm"
                >
                    <div className={`p-2 rounded-full mb-1 ${color}`}>
                        <Icon size={24} aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold">{label}</span>
                </button>
            ))}
        </div>
    );
};

export default MediaTool;

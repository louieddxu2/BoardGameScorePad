
import React from 'react';
import { Magnet, Focus, Camera, RotateCw, ArrowRight } from 'lucide-react';
import { useScannerTranslation } from '../../i18n/scanner';

interface ScannerControlsProps {
    isSnapping: boolean;
    onToggleSnap: () => void;
    onCenter: () => void;
    onRetake: () => void;
    onRotate: () => void;
    onConfirm: () => void;
    canConfirm: boolean;
}

const ScannerControls: React.FC<ScannerControlsProps> = ({
    isSnapping,
    onToggleSnap,
    onCenter,
    onRetake,
    onRotate,
    onConfirm,
    canConfirm
}) => {
    const { t } = useScannerTranslation();
    return (
        <footer className="p-4 modal-bg-elevated border-t border-surface-border flex items-center justify-between flex-none z-50">
            <div className="flex items-center gap-4">
                <button
                    onClick={onToggleSnap}
                    className={`flex flex-col items-center gap-1 text-xs font-bold transition-all active:scale-95 ${isSnapping ? 'text-brand-primary' : 'text-txt-muted'}`}
                >
                    <div className={`p-3 rounded-xl transition-colors ${isSnapping ? 'bg-brand-primary/10' : 'bg-modal-bg-recessed'}`}>
                        <Magnet size={20} />
                    </div>
                    {t('scan_btn_snap')}
                </button>
                <button
                    onClick={onCenter}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-txt-muted hover:text-txt-primary transition-all active:scale-95"
                >
                    <div className="p-3 rounded-xl bg-modal-bg-recessed">
                        <Focus size={20} />
                    </div>
                    {t('scan_btn_center')}
                </button>
                <button
                    onClick={onRetake}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-txt-muted hover:text-txt-primary transition-all active:scale-95"
                >
                    <div className="p-3 rounded-xl bg-modal-bg-recessed">
                        <Camera size={20} />
                    </div>
                    {t('scan_btn_retake')}
                </button>
                <button
                    onClick={onRotate}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-txt-muted hover:text-txt-primary transition-all active:scale-95"
                >
                    <div className="p-3 rounded-xl bg-modal-bg-recessed">
                        <RotateCw size={20} />
                    </div>
                    {t('scan_btn_rotate')}
                </button>
            </div>
            <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className="bg-brand-primary hover:filter hover:brightness-110 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all disabled:bg-surface-bg-alt disabled:text-txt-muted disabled:shadow-none disabled:active:scale-100"
            >
                <ArrowRight size={24} />
            </button>
        </footer>
    );
};

export default ScannerControls;

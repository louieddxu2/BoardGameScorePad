
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
        <footer className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-none z-50">
            <div className="flex items-center gap-4">
                <button
                    onClick={onToggleSnap}
                    className={`flex flex-col items-center gap-1 text-xs font-bold ${isSnapping ? 'text-emerald-400' : 'text-slate-500'}`}
                >
                    <div className={`p-3 rounded-xl ${isSnapping ? 'bg-emerald-900/30' : 'bg-slate-800'}`}>
                        <Magnet size={20} />
                    </div>
                    {t('scan_btn_snap')}
                </button>
                <button
                    onClick={onCenter}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"
                >
                    <div className="p-3 rounded-xl bg-slate-800">
                        <Focus size={20} />
                    </div>
                    {t('scan_btn_center')}
                </button>
                <button
                    onClick={onRetake}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"
                >
                    <div className="p-3 rounded-xl bg-slate-800">
                        <Camera size={20} />
                    </div>
                    {t('scan_btn_retake')}
                </button>
                <button
                    onClick={onRotate}
                    className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"
                >
                    <div className="p-3 rounded-xl bg-slate-800">
                        <RotateCw size={20} />
                    </div>
                    {t('scan_btn_rotate')}
                </button>
            </div>
            <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:bg-slate-700 disabled:text-slate-500"
            >
                <ArrowRight size={24} />
            </button>
        </footer>
    );
};

export default ScannerControls;
